import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, User, Calendar, Hash, FileText, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Validado': 'bg-gov-success text-primary-foreground',
  'Pendente': 'bg-gov-warning text-foreground',
  'Em Análise': 'bg-gov-info text-primary-foreground',
};

const DashboardPage = () => {
  const { professor, logout } = useAuth();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nav = useNavigate();
  
  if (!professor) return null;
  
  // Redirect admin to admin panel
  if (professor.role === 'admin') {
    nav('/admin');
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleContestacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo || !descricao || !whatsapp) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from('contestacoes').insert({
      professor_id: professor.id,
      motivo,
      descricao,
      whatsapp: whatsapp || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error('Erro ao enviar contestação.');
    } else {
      toast.success('Contestação enviada com sucesso!');
      setMotivo('');
      setDescricao('');
      setWhatsapp('');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">FUNDEF - Precatórios</h1>
            <p className="text-xs opacity-80">SEDUC Parnaíba</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 pb-20">
        {/* Welcome Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Bem-vindo, {professor.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground">Matrícula: {professor.matricula}</p>
                </div>
              </div>
              <Badge className={statusColors[professor.status] || 'bg-muted text-muted-foreground'}>
                {professor.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Período de Vínculo</p>
                  <p className="font-medium">{professor.vinculo_inicio} a {professor.vinculo_fim}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Hash className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">Total de Cotas</p>
                  <p className="font-medium">{professor.total_cotas} meses</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground text-xs">CPF</p>
                  <p className="font-medium">{professor.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contestation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> Abrir Contestação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContestacao} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="motivo">Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Divergência de período">Divergência de período</SelectItem>
                    <SelectItem value="Divergência de cotas">Divergência de cotas</SelectItem>
                    <SelectItem value="Dados cadastrais incorretos">Dados cadastrais incorretos</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva brevemente sua contestação..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp / Telefone *</Label>
                <Input
                  id="whatsapp"
                  placeholder="(86) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? 'Enviando...' : 'Enviar Contestação'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-muted-foreground border-t bg-background">
        Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
      </footer>
    </div>
  );
};

export default DashboardPage;
