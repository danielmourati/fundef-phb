import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "cookie-consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [openPolicy, setOpenPolicy] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (value: "accepted" | "rejected") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4">
        <div className="mx-auto max-w-5xl rounded-lg border border-border bg-card text-card-foreground shadow-lg">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
            <p className="text-sm text-muted-foreground">
              Utilizamos cookies essenciais para autenticação e funcionamento do
              sistema, conforme a Lei Geral de Proteção de Dados (LGPD).{" "}
              <button
                type="button"
                onClick={() => setOpenPolicy(true)}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Saiba mais
              </button>
              .
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => decide("rejected")}>
                Recusar
              </Button>
              <Button size="sm" onClick={() => decide("accepted")}>
                Aceitar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={openPolicy} onOpenChange={setOpenPolicy}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Política de Cookies</DialogTitle>
            <DialogDescription>
              Como utilizamos cookies e dados de navegação neste sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Este sistema utiliza apenas cookies e armazenamento local
              estritamente necessários para o seu funcionamento — como manter
              sua sessão autenticada após o login.
            </p>
            <p>
              Não utilizamos cookies de publicidade, rastreamento ou análise de
              comportamento. Nenhum dado pessoal é compartilhado com terceiros
              para fins comerciais.
            </p>
            <p>
              O tratamento dos dados segue a Lei Geral de Proteção de Dados
              (Lei nº 13.709/2018). Para mais informações ou para exercer seus
              direitos como titular, entre em contato com o Núcleo de
              Tecnologia e Dados da SEDUC Parnaíba.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsent;
