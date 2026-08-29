import { MCQQuestion, MCQResult } from '../types';

export class McqService {
  private static readonly MCQS_KEY = 'helix_mcqs';
  private static readonly RESULTS_KEY = 'helix_mcq_results';

  public static getMCQs(materialId: string): MCQQuestion[] {
    const raw = localStorage.getItem(this.MCQS_KEY);
    if (!raw) return [];
    const allMcqs: MCQQuestion[] = JSON.parse(raw);
    return allMcqs.filter(q => q.materialId === materialId);
  }

  public static saveMCQs(mcqs: MCQQuestion[]): void {
    const raw = localStorage.getItem(this.MCQS_KEY);
    let allMcqs: MCQQuestion[] = raw ? JSON.parse(raw) : [];
    
    // Remove existing for this material (if any) and append new
    if (mcqs.length > 0) {
      allMcqs = allMcqs.filter(q => q.materialId !== mcqs[0].materialId);
      allMcqs.push(...mcqs);
      localStorage.setItem(this.MCQS_KEY, JSON.stringify(allMcqs));
    }
  }

  public static saveResult(result: MCQResult): void {
    const raw = localStorage.getItem(this.RESULTS_KEY);
    const allResults: MCQResult[] = raw ? JSON.parse(raw) : [];
    
    // Check if answered before, if so replace
    const index = allResults.findIndex(r => r.questionId === result.questionId);
    if (index !== -1) {
      allResults[index] = result;
    } else {
      allResults.push(result);
    }
    
    localStorage.setItem(this.RESULTS_KEY, JSON.stringify(allResults));
  }

  public static getResults(materialId: string): MCQResult[] {
    const mcqs = this.getMCQs(materialId);
    const mcqIds = new Set(mcqs.map(q => q.id));
    
    const raw = localStorage.getItem(this.RESULTS_KEY);
    if (!raw) return [];
    const allResults: MCQResult[] = JSON.parse(raw);
    
    return allResults.filter(r => mcqIds.has(r.questionId));
  }
}
