import uuid
import os
import shutil
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.dispatch import receiver
import datetime
from django.utils import timezone


class CustomUser(AbstractUser):
    STATUS_CHOICES = [('active', 'Active'), ('suspend', 'Suspend')]
    full_name = models.CharField(max_length=150, blank=True, null=True)
    mobile_number = models.CharField(max_length=15, null=True, blank=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    parent_name = models.CharField(max_length=150, blank=True, null=True)
    country = models.CharField(max_length=150, blank=True, null=True)
    city = models.CharField(max_length=150, blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    class Meta:
        db_table = 'custom_user'

    def __str__(self):
        return self.email or self.username


class CourseVariant(models.Model):
    """Stub reference model matching the existing Ackadem schema."""
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'course_variant'

    def __str__(self):
        return self.name


class CourseManagement(models.Model):
    """Stub reference model for course management."""
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'course_management'

    def __str__(self):
        return self.title


class CourseAccessCode(models.Model):
    """Legacy access key model from the existing Ackadem schema."""
    course_variant = models.ForeignKey(
        CourseVariant,
        on_delete=models.CASCADE,
        related_name='access_codes',
        null=True,
        blank=True
    )
    code = models.CharField(max_length=6, unique=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    expiry_date = models.DateField(null=True, blank=True)
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Allocated', 'Allocated'),
        ('Expired', 'Expired'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Active')
    code_status = models.CharField(
        max_length=10,
        choices=[('Enabled', 'Enabled'), ('Disabled', 'Disabled')],
        default='Enabled',
        null=True,
        blank=True
    )

    class Meta:
        db_table = 'course_access_code'

    def __str__(self):
        return self.code


class Series(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    cover_image = models.FileField(upload_to='series_covers/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'series'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


def book_pdf_upload_path(instance, filename):
    """Store PDFs under media/books/<uuid>/<filename> or drafts"""
    folder = 'books' if instance.is_published else 'drafts'
    return f'{folder}/{instance.id}/{filename}'


class Book(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='books', null=True)
    title = models.CharField(max_length=500)
    pdf_file = models.FileField(upload_to=book_pdf_upload_path)
    total_pages = models.PositiveIntegerField(default=0)
    scripts = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    publish_date = models.DateField(default=timezone.now)
    is_published = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='books'
    )

    class Meta:
        db_table = 'book'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

@receiver(models.signals.post_delete, sender=Book)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    """Deletes file from storage when corresponding `Book` object is deleted."""
    if instance.pdf_file:
        try:
            instance.pdf_file.delete(save=False)
        except Exception:
            pass

@receiver(models.signals.pre_save, sender=Book)
def auto_move_file_on_status_change(sender, instance, **kwargs):
    """Move file between drafts and books folders when is_published changes."""
    if not instance.pk:
        return
    try:
        old_book = Book.objects.get(pk=instance.pk)
    except Book.DoesNotExist:
        return
    
    if old_book.is_published != instance.is_published and old_book.pdf_file:
        try:
            old_path = old_book.pdf_file.path
            if os.path.isfile(old_path):
                new_folder = 'books' if instance.is_published else 'drafts'
                new_rel_path = f"{new_folder}/{instance.id}/{os.path.basename(old_path)}"
                new_full_path = os.path.join(settings.MEDIA_ROOT, new_rel_path)
                
                os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
                shutil.move(old_path, new_full_path)
                instance.pdf_file.name = new_rel_path
                
                try:
                    os.rmdir(os.path.dirname(old_path))
                except OSError:
                    pass
        except NotImplementedError:
            # Remote storage like Cloudinary doesn't support local .path
            pass


class UserReadingProgress(models.Model):
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='reading_progress'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='reader_progress'
    )
    page_index = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_reading_progress'
        unique_together = ('user', 'book')

    def __str__(self):
        return f'{self.user} - {self.book} @ page {self.page_index}'


class MagazineAccessCode(models.Model):
    code = models.CharField(max_length=6, unique=True)
    series = models.ForeignKey(Series, on_delete=models.CASCADE, null=True, related_name='access_codes')
    generated_at = models.DateTimeField(auto_now_add=True)
    STATUS_CHOICES = [
        ('Inactive', 'Inactive'),
        ('Active', 'Active'),
        ('Revoked', 'Revoked'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Inactive')
    
    user_name = models.CharField(max_length=255, null=True, blank=True)
    user_email = models.EmailField(max_length=255, null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    duration_months = models.IntegerField(default=6)

    class Meta:
        db_table = 'magazine_access_code'
        ordering = ['-generated_at']

    def __str__(self):
        return f"{self.code} ({self.status})"


class SystemSettings(models.Model):
    notification_time = models.TimeField(default=datetime.time(8, 0))

    class Meta:
        db_table = 'system_settings'
        verbose_name_plural = 'System Settings'

    def __str__(self):
        return f"Settings (Notification at {self.notification_time})"

class InAppNotification(models.Model):
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='notifications')
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    message = models.TextField()
    scheduled_for = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'in_app_notification'
        ordering = ['-scheduled_for', '-created_at']

    def __str__(self):
        return f"Notification for {self.book.title}"
