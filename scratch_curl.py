import urllib.request
try:
    req = urllib.request.Request("https://hetzner.inphora.net", headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req)
    print("Status:", response.status)
    print("HTML Length:", len(response.read()))
except Exception as e:
    print("Error:", e)
