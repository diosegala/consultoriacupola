import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const PASSWORD_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export default function TrocarSenha() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const passwordErrors = [];
  if (password && password.length < 8) passwordErrors.push('Mínimo 8 caracteres');
  if (password && !PASSWORD_REGEX.test(password)) passwordErrors.push('Deve conter pelo menos 1 caractere especial (!@#$%...)');

  const isValid = password.length >= 8 && PASSWORD_REGEX.test(password) && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !user) return;

    setLoading(true);
    
    // Update password
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setLoading(false);
      toast({ title: 'Erro', description: pwError.message, variant: 'destructive' });
      return;
    }

    // Clear force_password_change flag
    const { error: flagError } = await supabase
      .from('user_roles')
      .update({ force_password_change: false } as any)
      .eq('user_id', user.id);

    setLoading(false);

    if (flagError) {
      toast({ title: 'Erro', description: flagError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso!' });
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <h1 className="text-3xl font-bold text-primary">CUPOLA</h1>
            <p className="text-xs text-muted-foreground tracking-widest">CONSULTORIA</p>
          </div>
          <CardTitle className="text-foreground">Trocar Senha</CardTitle>
          <CardDescription className="text-muted-foreground">
            Você precisa definir uma nova senha antes de continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-input border-border"
              />
              {passwordErrors.length > 0 && (
                <div className="space-y-1">
                  {passwordErrors.map((err, i) => (
                    <p key={i} className="text-sm text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-input border-border"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-destructive">As senhas não conferem</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !isValid}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Definir Nova Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
