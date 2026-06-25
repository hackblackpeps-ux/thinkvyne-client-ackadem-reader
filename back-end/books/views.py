import json
import random
import string
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Book, UserReadingProgress, MagazineAccessCode, Series, InAppNotification, SystemSettings
import datetime
from .serializers import (
    BookSerializer,
    BookListSerializer,
    UserReadingProgressSerializer,
    SeriesSerializer,
    InAppNotificationSerializer
)


class DebugClearAllView(APIView):
    def delete(self, request):
        Book.objects.all().delete()
        Series.objects.all().delete()
        MagazineAccessCode.objects.all().delete()
        UserReadingProgress.objects.all().delete()
        return Response({'success': True, 'message': 'Database completely wiped.'})


class SeriesListCreateView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get(self, request):
        series = Series.objects.all().order_by('-created_at')
        serializer = SeriesSerializer(series, many=True, context={'request': request})
        return Response({'series': serializer.data})

    def post(self, request):
        serializer = SeriesSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SeriesDetailView(APIView):
    def delete(self, request, pk):
        series = get_object_or_404(Series, pk=pk)
        series.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class SystemSettingsView(APIView):
    def get(self, request):
        settings, _ = SystemSettings.objects.get_or_create(id=1)
        return Response({'notification_time': settings.notification_time.strftime('%H:%M')})

    def post(self, request):
        time_str = request.data.get('notification_time')
        if not time_str:
            return Response({'error': 'notification_time required (HH:MM)'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            hour, minute = map(int, time_str.split(':'))
            settings, _ = SystemSettings.objects.get_or_create(id=1)
            settings.notification_time = datetime.time(hour, minute)
            settings.save()
            return Response({'notification_time': settings.notification_time.strftime('%H:%M')})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class NotificationListView(APIView):
    def get(self, request):
        notifs = InAppNotification.objects.filter(scheduled_for__lte=timezone.now())[:50]
        serializer = InAppNotificationSerializer(notifs, many=True)
        return Response({'notifications': serializer.data})

class BookUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        pdf_file = request.FILES.get('pdf_file')
        title = request.data.get('title', '').strip()
        scripts_raw = request.data.get('scripts', '[]')
        series_id = request.data.get('series_id')
        publish_date = request.data.get('publish_date')

        if not pdf_file and not request.data.get('magazine_id'):
            return Response({'error': 'pdf_file is required for new uploads.'}, status=status.HTTP_400_BAD_REQUEST)
        if not title:
            return Response({'error': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not series_id:
            return Response({'error': 'series_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            series = Series.objects.get(id=series_id)
        except Series.DoesNotExist:
            return Response({'error': 'Invalid series_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            scripts = json.loads(scripts_raw)
            if not isinstance(scripts, list):
                raise ValueError
        except (json.JSONDecodeError, ValueError):
            return Response({'error': 'scripts must be a valid JSON array.'}, status=status.HTTP_400_BAD_REQUEST)

        magazine_id = request.data.get('magazine_id')
        
        parsed_publish_date = None
        if publish_date:
            try:
                from django.utils.dateparse import parse_date
                parsed_publish_date = parse_date(publish_date)
            except:
                pass

        if magazine_id:
            try:
                book = Book.objects.get(id=magazine_id)
                book.title = title
                book.series = series
                if pdf_file:
                    book.pdf_file = pdf_file
                if parsed_publish_date:
                    book.publish_date = parsed_publish_date
                book.total_pages = len(scripts)
                book.scripts = scripts
                book.is_published = True
                if request.user.is_authenticated and not book.uploaded_by:
                    book.uploaded_by = request.user
                book.save()
            except Book.DoesNotExist:
                book = Book.objects.create(
                    id=magazine_id,
                    title=title,
                    series=series,
                    pdf_file=pdf_file,
                    publish_date=parsed_publish_date or timezone.now().date(),
                    total_pages=len(scripts),
                    scripts=scripts,
                    uploaded_by=request.user if request.user.is_authenticated else None,
                )
        else:
            book = Book.objects.create(
                title=title,
                series=series,
                pdf_file=pdf_file,
                publish_date=parsed_publish_date or timezone.now().date(),
                total_pages=len(scripts),
                scripts=scripts,
                uploaded_by=request.user if request.user.is_authenticated else None,
            )
            
        # Trigger InAppNotification if published
        if book.is_published:
            settings, _ = SystemSettings.objects.get_or_create(id=1)
            publish_datetime = timezone.make_aware(datetime.datetime.combine(book.publish_date, settings.notification_time))
            
            InAppNotification.objects.update_or_create(
                book=book,
                defaults={
                    'series': book.series,
                    'message': f"A new magazine '{book.title}' is now available!",
                    'scheduled_for': publish_datetime
                }
            )

        serializer = BookSerializer(book, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BookListView(APIView):
    def get(self, request):
        settings, _ = SystemSettings.objects.get_or_create(id=1)
        now = timezone.now()
        is_admin = request.headers.get('X-Admin-Request') == 'true'
        
        books = Book.objects.filter(is_published=True).order_by('-publish_date', '-created_at')
        
        visible_books = []
        for book in books:
            pub_datetime = timezone.make_aware(datetime.datetime.combine(book.publish_date, settings.notification_time))
            if is_admin or pub_datetime <= now:
                visible_books.append(book)
                
        serializer = BookListSerializer(visible_books, many=True, context={'request': request})
        return Response({'books': serializer.data})


class BookDetailView(APIView):
    def get(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        serializer = BookSerializer(book, context={'request': request})
        return Response(serializer.data)

    def delete(self, request, pk):
        book = get_object_or_404(Book, pk=pk)
        book.delete() # Trigger signal
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserReadingProgressView(APIView):
    def post(self, request, magazine_id):
        book = get_object_or_404(Book, pk=magazine_id)
        page_index = request.data.get('page_index', 0)

        try:
            page_index = int(page_index)
        except (TypeError, ValueError):
            return Response({'error': 'page_index must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.is_authenticated:
            progress, _ = UserReadingProgress.objects.update_or_create(
                user=request.user,
                book=book,
                defaults={'page_index': page_index},
            )
            return Response({'page_index': progress.page_index}, status=status.HTTP_200_OK)

        return Response({'page_index': page_index, 'note': 'Progress not persisted (unauthenticated).'}, status=status.HTTP_200_OK)

    def get(self, request, magazine_id):
        book = get_object_or_404(Book, pk=magazine_id)
        if request.user.is_authenticated:
            try:
                progress = UserReadingProgress.objects.get(user=request.user, book=book)
                return Response({'page_index': progress.page_index})
            except UserReadingProgress.DoesNotExist:
                return Response({'page_index': 0})
        return Response({'page_index': 0})


class MagazineAccessCodeGenerateView(APIView):
    def post(self, request):
        series_id = request.data.get('series_id')
        count = request.data.get('count', 500)
        duration_months = request.data.get('duration_months', 6)
        
        series = None
        if series_id:
            series = get_object_or_404(Series, id=series_id)

        new_codes = []
        for _ in range(int(count)):
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            new_codes.append(MagazineAccessCode(code=code, series=series, duration_months=int(duration_months)))
        
        MagazineAccessCode.objects.bulk_create(new_codes, ignore_conflicts=True)
        return Response({'message': f'Successfully generated {count} codes.'}, status=status.HTTP_201_CREATED)


class MagazineAccessCodeListView(APIView):
    def delete(self, request):
        MagazineAccessCode.objects.all().delete()
        return Response({'success': True, 'message': 'All codes deleted.'})

    def get(self, request):
        from django.core.paginator import Paginator
        page_num = request.query_params.get('page', 1)
        codes = MagazineAccessCode.objects.all().select_related('series').order_by('-generated_at')
        paginator = Paginator(codes, 20)
        page_obj = paginator.get_page(page_num)
        
        results = []
        for c in page_obj.object_list:
            results.append({
                'id': c.id,
                'code': c.code,
                'status': c.status,
                'generated_at': c.generated_at,
                'user_name': c.user_name,
                'user_email': c.user_email,
                'series_id': c.series_id,
                'series_title': c.series.title if c.series else None,
                'expires_at': c.expires_at
            })
        
        return Response({
            'codes': results,
            'total_pages': paginator.num_pages,
            'current_page': page_obj.number,
            'total_codes': paginator.count
        })


class MagazineAccessCodeRevokeView(APIView):
    def patch(self, request, pk):
        code_obj = get_object_or_404(MagazineAccessCode, pk=pk)
        code_obj.status = 'Revoked'
        code_obj.save()
        return Response({'success': True, 'message': 'Code revoked.'})


class MagazineAccessCodeRedeemView(APIView):
    def post(self, request):
        code_str = request.data.get('code', '').strip().upper()
        series_id = request.data.get('series_id')
        
        if request.user.is_authenticated:
            user_name = request.user.get_full_name() or request.user.username
            user_email = request.user.email
        else:
            user_name = request.data.get('user_name', 'Anonymous User').strip()
            user_email = request.data.get('user_email', 'anonymous@example.com').strip()
        
        if not code_str or not series_id:
            return Response({'error': 'Code and series_id are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        code_obj = MagazineAccessCode.objects.filter(code=code_str).first()
        if not code_obj:
            return Response({'error': 'Invalid access code.'}, status=status.HTTP_404_NOT_FOUND)
            
        if code_obj.status != 'Inactive':
            return Response({'error': f'This code is {code_obj.status.lower()}.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if code_obj.series_id and str(code_obj.series_id) != series_id:
            return Response({'error': 'This code is not valid for this series.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not Series.objects.filter(pk=series_id).exists():
            return Response({'error': 'Series not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        code_obj.status = 'Active'
        code_obj.series_id = series_id
        code_obj.user_name = user_name
        code_obj.user_email = user_email
        code_obj.expires_at = timezone.now() + timedelta(days=30 * code_obj.duration_months) # Dynamic expiry
        code_obj.save()
        
        return Response({'success': True, 'message': 'Successfully unlocked series.'})


class MagazineAccessCodeCheckView(APIView):
    def post(self, request):
        series_id = request.data.get('series_id')
        magazine_id = request.data.get('magazine_id')
        user_email = request.user.email if request.user.is_authenticated else request.data.get('user_email', 'anonymous@example.com')
        
        if not series_id or not user_email:
            return Response({'error': 'series_id and user_email required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        code_obj = MagazineAccessCode.objects.filter(
            series_id=series_id, 
            user_email=user_email,
            status='Active'
        ).first()
        
        if not code_obj:
            return Response({'has_access': False, 'message': 'No active access code found for this series.'})
            
        if code_obj.expires_at and code_obj.expires_at < timezone.now():
            return Response({'has_access': False, 'is_expired': True, 'message': 'Your access to this series has expired.'})

        if magazine_id:
            book = get_object_or_404(Book, pk=magazine_id)
            purchase_month = code_obj.generated_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            print("==== ACCESS CHECK ====")
            print(f"Book Publish Date: {book.publish_date}")
            print(f"Code Generated At: {code_obj.generated_at}")
            
            if book.publish_date:
                publish_month = book.publish_date.replace(day=1)
                print(f"Publish Month: {publish_month}, Purchase Month Date: {purchase_month.date()}")
                if publish_month < purchase_month.date():
                    print("BLOCKED!")
                    return Response({
                        'has_access': False, 
                        'message': 'This magazine was published before your subscription started.'
                    })
                else:
                    print("ALLOWED!")
            
        return Response({'has_access': True, 'is_expired': False})


class UserSubscriptionsView(APIView):
    def get(self, request):
        user_email = request.user.email if request.user.is_authenticated else request.query_params.get('user_email', 'anonymous@example.com')
        
        active_codes = MagazineAccessCode.objects.filter(
            user_email=user_email,
            status='Active'
        )
        
        subscriptions = {}
        for code in active_codes:
            if code.series_id:
                purchase_month = code.generated_at.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
                subscriptions[str(code.series_id)] = purchase_month.isoformat()
                
        return Response(subscriptions)


class MagazineAccessCodeUpdateExpiryView(APIView):
    def patch(self, request, pk):
        code_obj = get_object_or_404(MagazineAccessCode, pk=pk)
        expires_at_str = request.data.get('expires_at')
        
        if expires_at_str:
            try:
                from django.utils.dateparse import parse_datetime
                parsed_date = parse_datetime(expires_at_str)
                if not parsed_date:
                    raise ValueError("Invalid datetime string")
                code_obj.expires_at = parsed_date
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            code_obj.expires_at = None
            
        code_obj.save()
        return Response({'success': True, 'expires_at': code_obj.expires_at})
