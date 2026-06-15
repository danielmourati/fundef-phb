import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Info, KeyRound, ShieldCheck } from 'lucide-react';

const STORAGE_KEY = 'fundef_first_access_seen';

const FirstAccessInfoDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleConfirm = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto sm:mx-0 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Info className="h-6 w-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center sm:text-left">
            Orientações para o primeiro acesso
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center sm:text-left">
            Antes de entrar no sistema, leia as instruções abaixo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <KeyRound className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              No <strong>primeiro acesso</strong>, utilize seu <strong>CPF (somente números)</strong>{' '}
              tanto no campo <strong>CPF</strong> quanto no campo <strong>Senha</strong>.
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              Logo após entrar, o sistema irá solicitar a{' '}
              <strong>alteração da sua senha</strong> por motivos de segurança.
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction onClick={handleConfirm}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FirstAccessInfoDialog;
