import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, FileText, UserPlus } from 'lucide-react';
import anexoIIIAsset from '@/assets/anexo-iii-requerimento.pdf.asset.json';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Option = 'anexo-ii' | 'anexo-iii' | null;

const EMAIL = 'precatorios.parnaiba@edu.parnaiba.pi.gov.br';

const AccessReportDialog = ({ open, onOpenChange }: Props) => {
  const [option, setOption] = useState<Option>(null);

  const handleOpenChange = (v: boolean) => {
    if (!v) setOption(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reportar Problema de Acesso</DialogTitle>
        </DialogHeader>

        {option === null && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione abaixo a opção que melhor descreve o seu caso:
            </p>

            <button
              type="button"
              onClick={() => setOption('anexo-ii')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors flex gap-3"
            >
              <FileText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Seus dados estão incorretos ou incompletos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicite a correção ou complementação dos dados (Anexo II).
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOption('anexo-iii')}
              className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-primary/5 transition-colors flex gap-3"
            >
              <UserPlus className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">
                  Você trabalhou no período contemplado, mas seu nome não aparece na lista
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicite a inclusão como interessado (Anexo III).
                </p>
              </div>
            </button>
          </div>
        )}

        {option === 'anexo-ii' && (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              Solicite a correção ou complementação dos dados por meio do{' '}
              <strong>ANEXO II – Requerimento de Complementação e/ou Retificação de Dados</strong>,
              do Edital de Chamamento Público Nº 01/2026 – Rateio dos Precatórios do FUNDEF.
            </p>

            <div>
              <p className="font-semibold mb-2">Como enviar:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Baixe e preencha o formulário abaixo (Anexo II).</li>
                <li>Assine o formulário.</li>
                <li>Anexe toda a documentação exigida em formato PDF.</li>
                <li>
                  Envie para o e-mail:{' '}
                  <a
                    href={`mailto:${EMAIL}`}
                    className="text-primary font-medium hover:underline break-all"
                  >
                    {EMAIL}
                  </a>
                </li>
              </ol>
            </div>

            <div>
              <p className="font-semibold mb-1">Após o envio:</p>
              <p className="text-muted-foreground">
                Aguarde a análise e validação dos documentos para regularização do cadastro e
                liberação do acesso.
              </p>
            </div>
          </div>
        )}

        {option === 'anexo-iii' && (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              Solicite a inclusão por meio do{' '}
              <strong>
                ANEXO III – Requerimento de Inclusão de Interessado não constante na Lista
                Preliminar
              </strong>
              , do Edital de Chamamento Público Nº 01/2026 – Rateio dos Precatórios do FUNDEF.
            </p>

            <div>
              <p className="font-semibold mb-2">Documentos exigidos:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>RG e CPF;</li>
                <li>Número do PIS/PASEP/NIT;</li>
                <li>Comprovante de residência;</li>
                <li>Dados bancários do Banco do Brasil (agência e conta);</li>
                <li>Certidão de casamento (se houver);</li>
                <li>
                  Documentos que comprovem o vínculo de trabalho no período de julho de 2001 a
                  dezembro de 2006.
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-2">Como enviar:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Baixe e preencha o formulário abaixo (Anexo III).</li>
                <li>Assine o formulário.</li>
                <li>Anexe toda a documentação exigida em formato PDF.</li>
                <li>
                  Envie para o e-mail:{' '}
                  <a
                    href={`mailto:${EMAIL}`}
                    className="text-primary font-medium hover:underline break-all"
                  >
                    {EMAIL}
                  </a>
                </li>
              </ol>
            </div>

            <div>
              <p className="font-semibold mb-1">Após o envio:</p>
              <p className="text-muted-foreground">
                Aguarde a análise e validação dos documentos para regularização do cadastro e
                liberação do acesso.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {option === null ? (
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOption(null)}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button asChild>
                {option === 'anexo-ii' ? (
                  <a href="/anexo-ii-requerimento.pdf" download="Anexo-II-Requerimento.pdf">
                    <Download className="w-4 h-4" />
                    Baixar Formulário – Anexo II
                  </a>
                ) : (
                  <a href="/anexo-iii-requerimento.pdf" download="Anexo-III-Requerimento.pdf">
                    <Download className="w-4 h-4" />
                    Baixar Formulário – Anexo III
                  </a>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccessReportDialog;
