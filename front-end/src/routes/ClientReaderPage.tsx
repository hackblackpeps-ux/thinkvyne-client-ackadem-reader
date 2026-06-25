import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ReaderWrapper } from '../components/reader/ReaderWrapper';

export function ClientReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  const handleBack = () => {
    if (isPreview) {
      window.close();
      // Fallback if window.close() fails
      navigate('/admin/upload');
    } else {
      navigate('/library');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Reader Engine */}
      <div className="flex-1 overflow-hidden relative">
        <ReaderWrapper id={id || 'default'} onBack={handleBack} isPreview={isPreview} />
      </div>
    </div>
  );
}
