import requests

response = requests.post(
    "http://127.0.0.1:8010/synthesize",
    json={"query": "Bürgergeld"}
)
print(response.status_code)
print(response.json())
