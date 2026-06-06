import requests

SERVICE_URLS = {
    "customer": "http://localhost:8001/customer-service/customers",
    "onboarding": "http://localhost:8002/onboarding-service/onboarding-cases/verify",
    "payment": "http://localhost:8003/payment-service/process",
}


def create_demo_customer():
    payload = {"data": {"full_name": "Demo User", "document_id": "0912345678", "email": "demo@example.com"}}
    r = requests.post(SERVICE_URLS["customer"], json=payload)
    r.raise_for_status()
    return r.json()


def run_demo_onboarding(customer):
    payload = {"data": {"document_id": customer.get("document_id"), "full_name": customer.get("full_name")}}
    r = requests.post(SERVICE_URLS["onboarding"], json=payload)
    r.raise_for_status()
    return r.json()


def run_demo_payment(customer):
    payload = {"data": {"customer_id": customer.get("id"), "amount": 9.99, "method": "card", "mode": "success"}}
    r = requests.post(SERVICE_URLS["payment"], json=payload)
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    print("Creating demo customer...")
    c = create_demo_customer()
    print("Customer:", c)

    print("Running onboarding...")
    onb = run_demo_onboarding(c)
    print("Onboarding:", onb)

    print("Processing payment...")
    pay = run_demo_payment(c)
    print("Payment:", pay)

    print("Demo finished")
