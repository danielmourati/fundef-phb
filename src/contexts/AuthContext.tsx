import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Professor {
  id: string;
  nome: string;
  cpf: string;
  matricula: string;
  data_nascimento: string | null;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  total_cotas: number | null;
  role: string;
}

interface MatriculaItem extends Professor {
  token: string;
}

interface AuthContextType {
  professor: Professor | null;
  token: string | null;
  loading: boolean;
  matriculas: MatriculaItem[];
  setMatriculaAtiva: (id: string) => void;
  login: (identificador: string, senha: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'fundef_session';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [professor, setProfessor] = useState<Professor | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [matriculas, setMatriculas] = useState<MatriculaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const payloadB64 = parsed.token?.split('.')[0];
        if (payloadB64) {
          const payload = JSON.parse(atob(payloadB64));
          if (payload.exp > Date.now()) {
            setProfessor(parsed.professor);
            setToken(parsed.token);
            setMatriculas(parsed.matriculas || []);
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

  const persist = (prof: Professor, tk: string, mats: MatriculaItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ professor: prof, token: tk, matriculas: mats }));
  };

  const login = async (identificador: string, senha: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('custom-login', {
        body: { identificador, senha },
      });

      if (error || !data?.professor) {
        return { success: false, error: data?.error || 'CPF ou senha incorretos.' };
      }

      const mats: MatriculaItem[] = data.matriculas || [];
      // Se houver matrículas, usar a primeira (ordenada) como ativa para garantir consistência
      let prof: Professor = data.professor;
      let tk: string = data.token;
      if (mats.length > 0) {
        const first = mats[0];
        prof = {
          id: first.id, nome: first.nome, cpf: first.cpf, matricula: first.matricula,
          data_nascimento: first.data_nascimento, vinculo_inicio: first.vinculo_inicio,
          vinculo_fim: first.vinculo_fim, total_cotas: first.total_cotas,
          role: first.role,
        };
        tk = first.token;
      }

      setProfessor(prof);
      setToken(tk);
      setMatriculas(mats);
      persist(prof, tk, mats);
      return { success: true };
    } catch {
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const setMatriculaAtiva = (id: string) => {
    const found = matriculas.find(m => m.id === id);
    if (!found) return;
    const prof: Professor = {
      id: found.id, nome: found.nome, cpf: found.cpf, matricula: found.matricula,
      data_nascimento: found.data_nascimento, vinculo_inicio: found.vinculo_inicio,
      vinculo_fim: found.vinculo_fim, total_cotas: found.total_cotas,
      role: found.role,
    };
    setProfessor(prof);
    setToken(found.token);
    persist(prof, found.token, matriculas);
  };

  const logout = () => {
    setProfessor(null);
    setToken(null);
    setMatriculas([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ professor, token, loading, matriculas, setMatriculaAtiva, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
