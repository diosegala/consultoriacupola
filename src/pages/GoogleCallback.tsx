import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinishGoogleOAuth } from '@/hooks/useGoogleDrive';

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const finish = useFinishGoogleOAuth();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const code = params.get('code');
    const err = params.get('error');
    if (err) {
      setStatus('error');
      setMessage(err);
      return;
    }
    if (!code) {
      setStatus('error');
      setMessage('Código de autorização ausente');
      return;
    }
    const redirectUri = `${window.location.origin}/google-callback`;
    finish.mutate({ code, redirect_uri: redirectUri }, {
      onSuccess: (data: any) => {
        setStatus('success');
        setMessage(`Conectado como ${data.email}${data.pasta_meet_encontrada ? '' : ' (pasta Meet Recordings não encontrada)'}`);
      },
      onError: (e: any) => {
        setStatus('error');
        setMessage(e.message);
      },
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Conectando ao Google...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Conectado com sucesso!</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={() => navigate('/integracoes')} className="bg-primary text-primary-foreground">
              Voltar para Integrações
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">Falha na conexão</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <Button onClick={() => navigate('/integracoes')} variant="outline" className="border-border">
              Voltar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}