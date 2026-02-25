const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

// ─── LCU LOCKFILE READER ───────────────────────────────────────────────────────

// Common install roots across all drives
const DRIVES = ['C', 'D', 'E', 'F', 'G'];
const INSTALL_SUBDIRS = [
  'Riot Games\\League of Legends',
  'Games\\Riot Games\\League of Legends',
  'Program Files\\Riot Games\\League of Legends',
  'Program Files (x86)\\Riot Games\\League of Legends',
];

function buildDefaultPaths() {
  const paths = [];
  for (const drive of DRIVES) {
    for (const sub of INSTALL_SUBDIRS) {
      paths.push(`${drive}:\\${sub}\\lockfile`);
    }
  }
  return paths;
}

function parseLockfile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    const parts = content.split(':');
    if (parts.length < 5) return null;
    const [name, pid, port, password, protocol] = parts;
    return { name, pid: parseInt(pid), port: parseInt(port), password, protocol };
  } catch (e) {
    return null;
  }
}

/** Use PowerShell to get the running LeagueClientUx.exe path, then derive lockfile location */
function findLockfileViaPowerShell() {
  // Strategy 1: Get exe path from Get-Process (works even without admin)
  try {
    const exePath = execSync(
      `powershell -NoProfile -NonInteractive -Command "` +
      `(Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue | Select-Object -First 1).Path"`,
      { encoding: 'utf8', timeout: 8000 }
    ).trim();

    if (exePath && fs.existsSync(exePath)) {
      const installDir = path.dirname(exePath);
      const lockfilePath = path.join(installDir, 'lockfile');
      if (fs.existsSync(lockfilePath)) {
        console.log('[LCU] Found lockfile via PowerShell Get-Process:', lockfilePath);
        return parseLockfile(lockfilePath);
      }
    }
  } catch (e) {
    console.warn('[LCU] PowerShell Get-Process failed:', e.message);
  }

  // Strategy 2: WMI via PowerShell (Get-WmiObject — more reliable than wmic)
  try {
    const cmdLine = execSync(
      `powershell -NoProfile -NonInteractive -Command "` +
      `(Get-WmiObject Win32_Process -Filter 'name=\\"LeagueClientUx.exe\\"' | Select-Object -First 1).CommandLine"`,
      { encoding: 'utf8', timeout: 8000 }
    ).trim();

    if (cmdLine) {
      // Parse --app-port and --remoting-auth-token directly from command line
      const portMatch = cmdLine.match(/--app-port=(\d+)/);
      const tokenMatch = cmdLine.match(/--remoting-auth-token=([\w-]+)/);
      if (portMatch && tokenMatch) {
        console.log('[LCU] Got credentials from WMI command line');
        return {
          name: 'LeagueClientUx',
          pid: 0,
          port: parseInt(portMatch[1]),
          password: tokenMatch[1],
          protocol: 'https',
        };
      }
      // Parse install directory
      const dirMatch = cmdLine.match(/--install-directory=([^\s"]+)/);
      if (dirMatch) {
        const lockfilePath = path.join(dirMatch[1].replace(/"/g, ''), 'lockfile');
        if (fs.existsSync(lockfilePath)) return parseLockfile(lockfilePath);
      }
    }
  } catch (e) {
    console.warn('[LCU] PowerShell WMI failed:', e.message);
  }

  // Strategy 3: Legacy wmic
  try {
    const output = execSync(
      'wmic PROCESS WHERE "name=\'LeagueClientUx.exe\'" GET commandline /FORMAT:csv',
      { encoding: 'utf8', timeout: 5000, shell: true }
    );
    const portMatch = output.match(/--app-port=(\d+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/);
    if (portMatch && tokenMatch) {
      console.log('[LCU] Got credentials from wmic');
      return {
        name: 'LeagueClientUx',
        pid: 0,
        port: parseInt(portMatch[1]),
        password: tokenMatch[1],
        protocol: 'https',
      };
    }
  } catch (e) {
    console.warn('[LCU] wmic failed:', e.message);
  }

  return null;
}

function getLCUCredentials() {
  // 1. Try all known lockfile paths (multi-drive)
  for (const p of buildDefaultPaths()) {
    if (fs.existsSync(p)) {
      const creds = parseLockfile(p);
      if (creds) {
        console.log('[LCU] Found lockfile at:', p);
        return creds;
      }
    }
  }

  // 2. Try PowerShell process detection
  const fromProcess = findLockfileViaPowerShell();
  if (fromProcess) return fromProcess;

  console.error('[LCU] Could not find lockfile or process credentials');
  return null;
}

// ─── LCU HTTP CLIENT ──────────────────────────────────────────────────────────

function lcuRequest(port, password, endpoint) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${password}`).toString('base64');
    const options = {
      hostname: '127.0.0.1',
      port,
      path: endpoint,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      rejectUnauthorized: false, // LCU uses self-signed cert
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('LCU request timed out'));
    });
    req.end();
  });
}

// ─── DATA DRAGON CLIENT ───────────────────────────────────────────────────────

let ddVersion = null;
let championData = null; // { key -> { name, id } }

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function getDataDragonVersion() {
  if (ddVersion) return ddVersion;
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
  ddVersion = versions[0];
  return ddVersion;
}

async function getChampionData() {
  if (championData) return championData;
  const version = await getDataDragonVersion();
  const data = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
  // Build map: numeric key -> { name, id }
  championData = {};
  for (const [id, champ] of Object.entries(data.data)) {
    championData[champ.key] = { name: champ.name, id: champ.id };
  }
  return championData;
}

// ─── SKIN DATA BUILDER ────────────────────────────────────────────────────────

async function buildOwnedSkins(creds) {
  // Get current summoner
  const summoner = await lcuRequest(creds.port, creds.password, '/lol-summoner/v1/current-summoner');
  if (!summoner || !summoner.summonerId) throw new Error('Could not fetch summoner data');

  const summonerId = summoner.summonerId;

  // Get owned skins (minimal)
  const skinsData = await lcuRequest(
    creds.port,
    creds.password,
    `/lol-champions/v1/inventories/${summonerId}/skins-minimal`
  );

  if (!Array.isArray(skinsData)) throw new Error('Unexpected skins response from LCU');

  // Get Data Dragon champion mapping
  const champions = await getChampionData();

  // Filter owned skins (ownership flags)
  const ownedSkins = skinsData.filter((s) => s.ownership && s.ownership.owned);

  // Enrich with Data Dragon data
  const version = await getDataDragonVersion();
  const enriched = ownedSkins.map((skin) => {
    // skin.id format: championId * 1000 + skinNum  (e.g., 1001 = Ashe skin 1)
    const championId = Math.floor(skin.id / 1000);
    const skinNum = skin.id % 1000;
    const champ = champions[String(championId)] || { name: 'Unknown', id: 'Unknown' };

    const splashUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_${skinNum}.jpg`;
    const tilUrl = `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champ.id}_${skinNum}.jpg`;

    return {
      id: skin.id,
      name: skin.name,
      championId,
      championName: champ.name,
      championKey: champ.id,
      skinNum,
      splashUrl,
      tileUrl: tilUrl,
      isBase: skinNum === 0,
      hasChromas: skin.ownership && skin.ownership.rental ? false : false,
      skinLines: skin.skinLines || [],
    };
  });

  // Sort: by champion name, then skin num
  enriched.sort((a, b) => {
    const c = a.championName.localeCompare(b.championName);
    return c !== 0 ? c : a.skinNum - b.skinNum;
  });

  return {
    summoner: {
      displayName: summoner.displayName,
      summonerId,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      profileIconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${summoner.profileIconId}.png`,
    },
    skins: enriched,
    total: enriched.length,
    version,
  };
}

// ─── ELECTRON WINDOW ──────────────────────────────────────────────────────────

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Custom titlebar controls
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow.close());
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────

let cachedData = null;

async function fetchSkinsData() {
  const creds = getLCUCredentials();
  if (!creds) {
    throw new Error('LEAGUE_NOT_RUNNING');
  }
  const data = await buildOwnedSkins(creds);
  cachedData = data;
  return data;
}

ipcMain.handle('get-skins', async () => {
  try {
    return { success: true, data: await fetchSkinsData() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('refresh-skins', async () => {
  cachedData = null;
  ddVersion = null;
  championData = null;
  try {
    return { success: true, data: await fetchSkinsData() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
