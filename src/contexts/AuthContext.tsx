import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Periodo { inicio: string; fim: string; ordem?: number }

interface Professor {
  id: string;
  nome: string;
  email?: string | null;
  cpf: string;
  matricula: string;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  carga_horaria?: string | number | null;
  total_cotas: number | null;
  cargo?: string | null;
  role: string;
  status?: string | null;
  vinculo_status?: string | null;
  tipo?: 'efetivo' | 'contratado' | 'admin' | null;
  vinculo?: string | null;
  periodos?: Periodo[];
}

interface MatriculaItem extends Professor {
  token: string;
}

interface AuthContextType {
  professor: Professor | null;
  token: string | null;
  loading: boolean;
  matriculas: MatriculaItem[];
  requiresPasswordChange: boolean;
  setMatriculaAtiva: (id: string) => void;
  login: (identificador: string, senha: string, tipo?: 'efetivo' | 'contratado') => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'fundef_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [matriculas, setMatriculas] = useState<MatriculaItem[]>([]);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [loading, setLoading] = useState(true);

  // Normaliza role: apenas 'admin' e 'juridico' são papéis especiais; qualquer
  // outro valor (incluindo status do banco como 'ATIVO') é tratado como professor.
  const normalizeRole = (r: string | null | undefined): string => {
    const v = (r || '').toString().toLowerCase().trim();
    return v === 'admin' || v === 'juridico' ? v : 'professor';
  };
  const normalizeProfessor = (p: Professor): Professor => ({
    ...p,
    vinculo_status: p.vinculo_status ?? p.role ?? null,
    role: normalizeRole(p.role),
  });
  const normalizeMats = (mats: MatriculaItem[]): MatriculaItem[] =>
    mats.map((m) => ({ ...m, vinculo_status: m.vinculo_status ?? m.role ?? null, role: normalizeRole(m.role) }));

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const payloadB64 = parsed.token?.split('.')[0];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64));
          if (payload.exp > Date.now()) {
            setProfessor(parsed.professor ? normalizeProfessor(parsed.professor) : null);
            setToken(parsed.token);
            setMatriculas(normalizeMats(parsed.matriculas || []));
            setRequiresPasswordChange(parsed.requiresPasswordChange || false);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const persist = (prof: Professor, tk: string, mats: MatriculaItem[], reqPwdChange: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ professor: prof, token: tk, matriculas: mats, requiresPasswordChange: reqPwdChange }));
  };

  const login = async (identificador: string, senha: string, tipo?: 'efetivo' | 'contratado') => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { identificador, senha, tipo },
      });

      if (error || !data?.professor) {
        return { success: false, error: data?.error || 'CPF ou senha incorretos.' };
      }


      const matsRaw: MatriculaItem[] = data.matriculas || [];
      const mats = normalizeMats(matsRaw);
      // Se houver matrículas, usar a primeira (ordenada) como ativa para garantir consistência
      let prof: Professor = normalizeProfessor(data.professor);
      let tk: string = data.token;
      if (mats.length > 0) {
        const first = mats[0];
        prof = normalizeProfessor({
          id: first.id, nome: first.nome, cpf: first.cpf, matricula: first.matricula,
          vinculo_inicio: first.vinculo_inicio,
          vinculo_fim: first.vinculo_fim,
          carga_horaria: first.carga_horaria ?? null,
          total_cotas: first.total_cotas,
          cargo: first.cargo ?? null,
          role: first.role, status: (first as any).status ?? null,
          vinculo_status: first.vinculo_status ?? null,
        });
        tk = first.token;
      }

      setProfessor(prof);
      setToken(tk);
      setMatriculas(mats);
      const reqPwdChange = data.requires_password_change || false;
      setRequiresPasswordChange(reqPwdChange);
      persist(prof, tk, mats, reqPwdChange);
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const setMatriculaAtiva = (id: string) => {
    const found = matriculas.find(m => m.id === id);
    if (!found) return;
    const prof: Professor = normalizeProfessor({
      id: found.id, nome: found.nome, cpf: found.cpf, matricula: found.matricula,
      vinculo_inicio: found.vinculo_inicio,
      vinculo_fim: found.vinculo_fim,
      carga_horaria: found.carga_horaria ?? null,
      total_cotas: found.total_cotas,
      cargo: found.cargo ?? null,
      role: found.role, status: (found as any).status ?? null,
      vinculo_status: found.vinculo_status ?? null,
    });
    setProfessor(prof);
    setToken(found.token);
    persist(prof, found.token, matriculas, requiresPasswordChange);
  };

  const logout = () => {
    setProfessor(null);
    setToken(null);
    setMatriculas([]);
    setRequiresPasswordChange(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ professor, token, loading, matriculas, requiresPasswordChange, setMatriculaAtiva, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
