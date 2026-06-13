import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskCPF, unmaskCPF, maskPhone } from '@/lib/masks';
import { toast } from '@/hooks/use-toast';

export const TIPO_VINCULO_OPTIONS = [
  'Efetivo',
  'Contrato Temporário',
  'Aposentado',
  'Pensionista',
  'Outro',
];

export const ASSUNTO_OPTIONS = [
  'Meu nome foi divulgado mas não tenho cadastro',
  'Não lembro/não tenho CPF cadastrado',
  'Erro ao acessar com CPF e senha',
  'Outro',
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const AccessReportDialog = ({ open, onOpenChange }: Props) => {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setNome(''); setCpf(''); setTipoVinculo(''); setWhatsapp('');
    setEmail(''); setAssunto(''); setDescricao('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !cpf || !tipoVinculo || !whatsapp || !assunto) {
      toast({ title: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }
    if (unmaskCPF(cpf).length !== 11) {
      toast({ title: 'CPF inválido.', variant: 'destructive' });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'E-mail inválido.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('professor-api?action=create_access_report', {
      body: {
        nome_completo: nome.trim(),
        cpf: unmaskCPF(cpf),
        tipo_vinculo: tipoVinculo,
        whatsapp,
        email: email.trim() || undefined,
        assunto,
        descricao: descricao.trim() || undefined,
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast({ title: data?.error || 'Erro ao enviar relato.', variant: 'destructive' });
      return;
    }
    toast({
      title: 'Relato enviado com sucesso!',
      description: `Protocolo: ${data?.protocolo || '—'}. Nossa equipe entrará em contato.`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reportar problema de acesso</DialogTitle>
          <DialogDescription>
            Se você foi contemplado mas não consegue acessar o sistema, preencha o formulário abaixo. Nossa equipe analisará e entrará em contato.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ar-nome">Nome completo *</Label>
            <Input id="ar-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={150} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ar-cpf">CPF *</Label>
              <Input
                id="ar-cpf"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-vinculo">Tipo de vínculo *</Label>
              <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
                <SelectTrigger id="ar-vinculo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPO_VINCULO_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ar-whats">WhatsApp *</Label>
              <Input
                id="ar-whats"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                inputMode="numeric"
                maxLength={15}
                placeholder="(86) 99999-9999"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-email">E-mail</Label>
              <Input
                id="ar-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={150}
                placeholder="opcional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-assunto">Assunto principal *</Label>
            <Select value={assunto} onValueChange={setAssunto}>
              <SelectTrigger id="ar-assunto"><SelectValue placeholder="Selecione o assunto" /></SelectTrigger>
              <SelectContent>
                {ASSUNTO_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ar-desc">Descrição (opcional)</Label>
            <Textarea
              id="ar-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Detalhes adicionais que ajudem nossa equipe..."
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar relato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AccessReportDialog;
