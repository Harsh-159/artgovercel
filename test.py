import requests
def test_payment_intent(amount: float = 0.99, artwork_id: str = "test-artwork-123"):
    url = "https://artgovercel-7g8bvg0mz-harshyadavinc-4527s-projects.vercel.app/api/create-payment-intent"
    
    response = requests.post(url, json={
        "amount": amount,
        "artworkId": artwork_id
    })
    
    print(f"Status: {response.status_code}")
    print(f"Raw response: {response.text}")  # always print raw first
    
    try:
        data = response.json()
        if response.status_code == 200:
            client_secret = data.get("clientSecret")
            print(f"✅ Success — clientSecret: {client_secret[:20]}...")
        else:
            print(f"❌ Failed: {data}")
    except Exception as e:
        print(f"❌ Not JSON: {e}")
test_payment_intent()