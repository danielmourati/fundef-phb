import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AccessReportDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reportar Problema de Acesso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-foreground">
          <p>
            Se seus dados estão incorretos ou incompletos no sistema, você pode solicitar a correção
            por meio do formulário oficial de <strong>Requerimento de Complementação e/ou Retificação
            de Dados</strong> (Anexo II do Edital de Chamamento Público Nº 01/2026 – Rateio dos
            Precatórios do FUNDEF).
          </p>

          <div>
            <p className="font-semibold mb-2">Como proceder:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>Baixe o formulário clicando no botão abaixo</li>
              <li>
                Preencha com seus dados pessoais, descreva a informação a ser corrigida ou
                complementada e anexe os documentos comprobatórios
              </li>
              <li>
                Envie o formulário preenchido e assinado para o e-mail:{' '}
                <a
                  href="mailto:precatorios.parnaiba@edu.parnaiba.pi.gov.br"
                  className="text-primary font-medium hover:underline break-all"
                >
                  precatorios.parnaiba@edu.parnaiba.pi.gov.br
                </a>
              </li>
            </ol>
          </div>

          <p className="text-muted-foreground">
            Após o envio, aguarde o retorno da equipe jurídica para regularização do seu acesso.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button asChild>
            <a href="/anexo-ii-requerimento.pdf" download="Anexo-II-Requerimento.pdf">
              <Download className="w-4 h-4" />
              Baixar Formulário
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccessReportDialog;
