"use client";

import { createContext, useContext, useState, ReactNode } from "react";

// Types
export interface Document {
  id: string;
  name: string;
  client: string;
  template: string;
  date: string;
  status: "Draft" | "Complete" | "Pending Review";
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface Phrase {
  id: string;
  title: string;
  content: string;
  offenceTags: string[];
  stage: string;
  category: string;
  triggerKeywords: string[];
  confidence: number;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  caseRef: string;
}

export interface ExtractedField {
  id: string;
  fieldName: string;
  suggestedValue: string;
  confidence: number;
  approved: boolean;
}

// Mock Data
const mockDocuments: Document[] = [
  { id: "1", name: "Defence Statement - Smith", client: "John Smith", template: "Defence Statement", date: "2024-01-15", status: "Complete" },
  { id: "2", name: "Witness Statement - Jones", client: "Sarah Jones", template: "Witness Statement", date: "2024-01-14", status: "Draft" },
  { id: "3", name: "Legal Brief - Williams", client: "David Williams", template: "Legal Brief", date: "2024-01-13", status: "Pending Review" },
  { id: "4", name: "Appeal Notice - Brown", client: "Emma Brown", template: "Appeal Notice", date: "2024-01-12", status: "Complete" },
  { id: "5", name: "Bail Application - Taylor", client: "Michael Taylor", template: "Bail Application", date: "2024-01-11", status: "Draft" },
];

const mockTemplates: Template[] = [
  { id: "1", name: "Defence Statement", description: "Standard defence statement template for Crown Court proceedings", category: "Defence" },
  { id: "2", name: "Witness Statement", description: "Template for recording witness testimonies with proper formatting", category: "Statements" },
  { id: "3", name: "Legal Brief", description: "Comprehensive legal brief template for case preparation", category: "Briefs" },
  { id: "4", name: "Appeal Notice", description: "Notice of appeal template for higher court submissions", category: "Appeals" },
  { id: "5", name: "Bail Application", description: "Bail application template with supporting arguments", category: "Applications" },
  { id: "6", name: "Plea in Mitigation", description: "Structured template for mitigation pleas", category: "Pleas" },
];

const mockPhrases: Phrase[] = [
  { id: "1", title: "Previous Good Character", content: "The defendant is of previous good character...", offenceTags: ["General", "Mitigation"], stage: "Sentencing", category: "Character", triggerKeywords: ["good character", "no previous"], confidence: 95 },
  { id: "2", title: "Remorse Expression", content: "The defendant has expressed genuine remorse...", offenceTags: ["General"], stage: "Sentencing", category: "Mitigation", triggerKeywords: ["remorse", "sorry", "regret"], confidence: 88 },
  { id: "3", title: "Employment Impact", content: "A custodial sentence would result in loss of employment...", offenceTags: ["General", "Mitigation"], stage: "Sentencing", category: "Personal Circumstances", triggerKeywords: ["employment", "job", "work"], confidence: 92 },
  { id: "4", title: "Mental Health Consideration", content: "The defendant suffers from diagnosed mental health conditions...", offenceTags: ["Mental Health"], stage: "Pre-sentence", category: "Medical", triggerKeywords: ["mental health", "depression", "anxiety"], confidence: 85 },
  { id: "5", title: "Family Responsibilities", content: "The defendant is the primary carer for dependent children...", offenceTags: ["Family"], stage: "Sentencing", category: "Personal Circumstances", triggerKeywords: ["children", "carer", "family"], confidence: 90 },
];

const mockClients: Client[] = [
  { id: "1", name: "John Smith", email: "john.smith@email.com", company: "Smith Enterprises", caseRef: "CS-2024-001" },
  { id: "2", name: "Sarah Jones", email: "sarah.jones@email.com", company: "Jones Ltd", caseRef: "CS-2024-002" },
  { id: "3", name: "David Williams", email: "d.williams@email.com", company: "Williams & Co", caseRef: "CS-2024-003" },
  { id: "4", name: "Emma Brown", email: "emma.brown@email.com", company: "Brown Associates", caseRef: "CS-2024-004" },
  { id: "5", name: "Michael Taylor", email: "m.taylor@email.com", company: "Taylor Group", caseRef: "CS-2024-005" },
];

// Context
interface AppContextType {
  documents: Document[];
  templates: Template[];
  phrases: Phrase[];
  clients: Client[];
  addDocument: (doc: Omit<Document, "id">) => void;
  addPhrase: (phrase: Omit<Phrase, "id">) => void;
  updatePhrase: (id: string, phrase: Partial<Phrase>) => void;
  deletePhrase: (id: string) => void;
  addClient: (client: Omit<Client, "id">) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [templates] = useState<Template[]>(mockTemplates);
  const [phrases, setPhrases] = useState<Phrase[]>(mockPhrases);
  const [clients, setClients] = useState<Client[]>(mockClients);

  const addDocument = (doc: Omit<Document, "id">) => {
    setDocuments((prev) => [...prev, { ...doc, id: String(prev.length + 1) }]);
  };

  const addPhrase = (phrase: Omit<Phrase, "id">) => {
    setPhrases((prev) => [...prev, { ...phrase, id: String(prev.length + 1) }]);
  };

  const updatePhrase = (id: string, updates: Partial<Phrase>) => {
    setPhrases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const deletePhrase = (id: string) => {
    setPhrases((prev) => prev.filter((p) => p.id !== id));
  };

  const addClient = (client: Omit<Client, "id">) => {
    setClients((prev) => [...prev, { ...client, id: String(prev.length + 1) }]);
  };

  return (
    <AppContext.Provider
      value={{
        documents,
        templates,
        phrases,
        clients,
        addDocument,
        addPhrase,
        updatePhrase,
        deletePhrase,
        addClient,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
