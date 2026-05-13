export const PANEL_IDS = [
  'tasks',
  'on-leave',
  'at-base',
  'free-soldiers',
  'returning',
  'departed',
  'absent',
  'departments',
] as const;

export type PanelId = typeof PANEL_IDS[number];

export const PANEL_LABELS: Record<PanelId, string> = {
  'tasks':         "Today's Tasks",
  'on-leave':      'Soldiers at Home',
  'at-base':       'Soldiers at Base',
  'free-soldiers': 'Free Soldiers Today',
  'returning':     'Returning Today (RTN)',
  'departed':      'Departed Today (OUT)',
  'absent':        'Absent Today (ABS)',
  'departments':   'Active Soldiers by Department',
};
