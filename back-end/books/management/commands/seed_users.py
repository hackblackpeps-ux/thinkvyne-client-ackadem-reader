from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Seeds the database with default admin and student users for development.'

    def handle(self, *args, **kwargs):
        # ── Admin / Superuser ────────────────────────────────────────────────
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@ackadem.com',
                password='LF*eg59J8fzFiK?D',
                full_name='Ackadem Admin',
                status='active',
            )
            self.stdout.write(self.style.SUCCESS('Created superuser: admin / LF*eg59J8fzFiK?D'))
        else:
            self.stdout.write(self.style.WARNING('Superuser "admin" already exists, skipping.'))

        # ── Student User ─────────────────────────────────────────────────────
        if not User.objects.filter(email='kavya@gmail.com').exists():
            User.objects.create_user(
                username='kavya',
                email='kavya@gmail.com',
                password='Snehat@123',
                full_name='Kavya',
                status='active',
            )
            self.stdout.write(self.style.SUCCESS('Created student user: kavya@gmail.com / Snehat@123'))
        else:
            self.stdout.write(self.style.WARNING('User "kavya@gmail.com" already exists, skipping.'))

        self.stdout.write(self.style.SUCCESS('Seeding complete.'))
