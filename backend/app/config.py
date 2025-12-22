import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://vault:vaultpass@db:5432/vault")
APP_ENV = os.getenv("APP_ENV", "local")

# Admin access
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")  # Change in production via env

# Notification variants accepted (extend as needed)
ALLOWED_VARIANT_IDS = {"A", "B", "LOSS_BANNER_A", "LOSS_BANNER_B", "SOCIAL_PROOF_A", "SOCIAL_PROOF_B", "TICKET_ZERO_A", "TICKET_ZERO_B"}

# Notification types allowed
ALLOWED_NOTIFY_TYPES = {"EXPIRY_D2", "EXPIRY_D0", "ATTENDANCE_D2", "TICKET_ZERO", "SOCIAL_PROOF"}

# Compensation retry policy
COMPENSATION_MAX_RETRIES = int(os.getenv("COMPENSATION_MAX_RETRIES", "5"))
COMPENSATION_BACKOFF_SECONDS = [1, 5, 30, 300, 900]
