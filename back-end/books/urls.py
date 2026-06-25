from django.urls import path
from . import views

urlpatterns = [
    # ── Series Endpoints ────────────────────────────────────────────────────────
    path('series/', views.SeriesListCreateView.as_view(), name='series-list-create'),
    path('series/<str:pk>/', views.SeriesDetailView.as_view(), name='series-detail'),

    # ── Notifications & Settings Endpoints ──────────────────────────────────────────────────
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('settings/', views.SystemSettingsView.as_view(), name='settings'),

    # ── Book (Published) Endpoints ──────────────────────────────────────────────
    path('books/upload/', views.BookUploadView.as_view(), name='book-upload'),
    path('books/', views.BookListView.as_view(), name='book-list'),
    path('books/view/<str:pk>/', views.BookDetailView.as_view(), name='book-detail'),
    path('magazines/<str:pk>/', views.BookDetailView.as_view(), name='magazine-detail'),

    # ── User Progress Endpoints ─────────────────────────────────────────────────
    path('users/progress/<str:magazine_id>/', views.UserReadingProgressView.as_view(), name='user-progress'),

    # ── Magazine Access Code Endpoints (Global) ───────────────────────────────
    path('codes/generate/', views.MagazineAccessCodeGenerateView.as_view(), name='generate-codes'),
    path('codes/', views.MagazineAccessCodeListView.as_view(), name='list-codes'),
    path('codes/<str:pk>/revoke/', views.MagazineAccessCodeRevokeView.as_view(), name='revoke-code'),
    path('codes/<str:pk>/expiry/', views.MagazineAccessCodeUpdateExpiryView.as_view(), name='update-expiry'),
    path('codes/redeem/', views.MagazineAccessCodeRedeemView.as_view(), name='redeem-code'),
    path('codes/check/', views.MagazineAccessCodeCheckView.as_view(), name='check-code'),
    path('codes/subscriptions/', views.UserSubscriptionsView.as_view(), name='user-subscriptions'),

    # ── Debug / Environment Reset ─────────────────────────────────────────────
    path('debug/clear-all/', views.DebugClearAllView.as_view(), name='debug-clear'),
]
