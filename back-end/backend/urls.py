"""
URL configuration for backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # All /api/* routes are handled by the books app
    path('api/', include('books.urls')),
]

# Serve uploaded media files (PDFs) in development
# In production the Gunicorn/Nginx setup will handle this via the MEDIA_ROOT directory.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
