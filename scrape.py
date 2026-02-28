import urllib.request
import re
import json

url = "https://wiki.leagueoflegends.com/en-us/List_of_champion_skins"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    
    tbody_search = re.search(r'<tbody[^>]*>([\s\S]*?)</tbody>', html)
    if not tbody_search:
        print("No tbody")
        exit(1)
    tbody = tbody_search.group(1)
    
    rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', tbody)
    prices = {}
    for row in rows[1:]:
        cols = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row)
        if len(cols) >= 4:
            champ = re.sub(r'<[^>]*>', '', cols[0]).strip()
            skin = re.sub(r'<[^>]*>', '', cols[1]).strip()
            # remove hidden styles
            costHtml = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', cols[3])
            costText = re.sub(r'<[^>]*>', ' ', costHtml).strip()
            cost = costText.split()[0] if costText else 'Special'
            if not cost: cost = 'Special'
            
            key = f"{re.sub(r'[^a-zA-Z0-9]', '', champ).lower()}_{re.sub(r'[^a-zA-Z0-9]', '', skin).lower()}"
            prices[key] = cost

    with open('assets/skin_prices.json', 'w') as f:
        json.dump(prices, f, indent=2)
    print(f"Saved {len(prices)} skins to assets/skin_prices.json")
except Exception as e:
    print("Error:", e)
