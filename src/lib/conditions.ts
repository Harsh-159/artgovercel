export type Condition = 'Always' | 'Day' | 'Night' | 'Rain' | 'Summer';

export interface EnvironmentalState {
  time: 'Day' | 'Night';
  isSummer: boolean;
  isRaining: boolean;
}

export function getCurrentEnvironment(): EnvironmentalState {
  const now = new Date();
  const month = now.getMonth();
  const hour = now.getHours();

  return {
    time: hour >= 6 && hour < 20 ? 'Day' : 'Night',
    isSummer: month >= 5 && month <= 7, // June-August
    isRaining: false // Hardcoded for now unless user wants real weather API
  };
}

export function getActiveConditions(): Condition[] {
  const env = getCurrentEnvironment();
  const active: Condition[] = ['Always'];
  
  active.push(env.time);
  if (env.isSummer) active.push('Summer');
  if (env.isRaining) active.push('Rain');
  
  return active;
}

export function checkConditionsMet(requested: string[]): { met: boolean; missing: string[] } {
  if (requested.includes('Always')) return { met: true, missing: [] };
  
  const active = getActiveConditions();
  const missing = requested.filter(r => !active.includes(r as Condition));
  
  return {
    met: missing.length === 0,
    missing
  };
}
