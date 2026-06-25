import json
from io import BytesIO
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from .models import Book


class BookUploadTests(TestCase):
    """Tests for POST /api/books/upload/"""

    def setUp(self):
        self.client = APIClient()
        # Minimal valid PDF binary (1-page stub)
        self.pdf_content = b'%PDF-1.4 stub content'
        self.scripts = json.dumps(['Page 1 narration', '', 'Page 3 [pause: 2s] content'])

    def _make_pdf(self, name='test.pdf'):
        return SimpleUploadedFile(name, self.pdf_content, content_type='application/pdf')

    def test_upload_book_success(self):
        """A valid multipart upload should create a Book and return 201."""
        response = self.client.post(
            '/api/books/upload/',
            {
                'pdf_file': self._make_pdf(),
                'title': 'Tell Me More - May 2026',
                'scripts': self.scripts,
            },
            format='multipart'
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('magazine_id', data)
        self.assertEqual(data['title'], 'Tell Me More - May 2026')
        self.assertEqual(data['total_pages'], 3)
        self.assertIsInstance(data['scripts'], list)
        self.assertEqual(len(data['scripts']), 3)
        # Pacing tags must be preserved exactly
        self.assertIn('[pause: 2s]', data['scripts'][2])

    def test_upload_missing_pdf(self):
        """Missing pdf_file should return 400."""
        response = self.client.post(
            '/api/books/upload/',
            {'title': 'No File', 'scripts': self.scripts},
            format='multipart'
        )
        self.assertEqual(response.status_code, 400)

    def test_upload_missing_title(self):
        """Missing title should return 400."""
        response = self.client.post(
            '/api/books/upload/',
            {'pdf_file': self._make_pdf(), 'scripts': self.scripts},
            format='multipart'
        )
        self.assertEqual(response.status_code, 400)

    def test_upload_invalid_scripts(self):
        """Non-JSON scripts string should return 400."""
        response = self.client.post(
            '/api/books/upload/',
            {'pdf_file': self._make_pdf(), 'title': 'Test', 'scripts': 'NOT JSON'},
            format='multipart'
        )
        self.assertEqual(response.status_code, 400)


class BookDetailTests(TestCase):
    """Tests for GET /api/books/view/<id>/ and GET /api/magazines/<id>/"""

    def setUp(self):
        self.client = APIClient()
        self.book = Book.objects.create(
            title='Tell Me More',
            pdf_file=SimpleUploadedFile('test.pdf', b'%PDF stub', content_type='application/pdf'),
            total_pages=3,
            scripts=['Hello page 1', '', 'Page 3 [pause: 1s] text'],
        )

    def test_fetch_book_by_id(self):
        """GET /api/books/view/<id>/ should return the full MagazinePayload."""
        response = self.client.get(f'/api/books/view/{self.book.id}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['magazine_id'], str(self.book.id))
        self.assertEqual(data['title'], 'Tell Me More')
        self.assertIn('pdf_url', data)
        self.assertEqual(data['total_pages'], 3)
        self.assertEqual(len(data['scripts']), 3)

    def test_fetch_book_via_magazines_alias(self):
        """GET /api/magazines/<id>/ alias should return identical payload."""
        response = self.client.get(f'/api/magazines/{self.book.id}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['magazine_id'], str(self.book.id))

    def test_fetch_nonexistent_book_returns_404(self):
        """Non-existent book ID should return 404."""
        response = self.client.get('/api/books/view/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, 404)


class UserProgressTests(TestCase):
    """Tests for POST/GET /api/users/progress/<id>/"""

    def setUp(self):
        self.client = APIClient()
        self.book = Book.objects.create(
            title='Progress Book',
            pdf_file=SimpleUploadedFile('prog.pdf', b'%PDF', content_type='application/pdf'),
            total_pages=10,
            scripts=[''] * 10,
        )

    def test_sync_progress_unauthenticated(self):
        """Unauthenticated progress POST should acknowledge without saving."""
        response = self.client.post(
            f'/api/users/progress/{self.book.id}/',
            {'page_index': 5},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['page_index'], 5)

    def test_invalid_page_index_returns_400(self):
        """Non-integer page_index should return 400."""
        response = self.client.post(
            f'/api/users/progress/{self.book.id}/',
            {'page_index': 'notanumber'},
            format='json'
        )
        self.assertEqual(response.status_code, 400)
