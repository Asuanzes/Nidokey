// Iconos lineales de la barra de pestañas para estilo 2100.
// Misma forma pública que TAB_ICON_SVG; monocromos vía currentColor para SvgXml.
// Familia visual: Solar linear (records=widget, search=magnifer, duplicates=copy, account=user-circle).

export const TAB_ICON_SVG_2100 = {
  records: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7c0-1.886 0-2.828.586-3.414S5.114 3 7 3s2.828 0 3.414.586S11 5.114 11 7s0 2.828-.586 3.414S8.886 11 7 11s-2.828 0-3.414-.586S3 8.886 3 7m10 10c0-1.886 0-2.828.586-3.414S15.114 13 17 13s2.828 0 3.414.586S21 15.114 21 17s0 2.828-.586 3.414S18.886 21 17 21s-2.828 0-3.414-.586S13 18.886 13 17"/><path d="M3 17c0-1.886 0-2.828.586-3.414S5.114 13 7 13s2.828 0 3.414.586S11 15.114 11 17s0 2.828-.586 3.414S8.886 21 7 21s-2.828 0-3.414-.586S3 18.886 3 17m10-10c0-1.886 0-2.828.586-3.414S15.114 3 17 3s2.828 0 3.414.586S21 5.114 21 7s0 2.828-.586 3.414S18.886 11 17 11s-2.828 0-3.414-.586S13 8.886 13 7"/></g></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 20a8.5 8.5 0 1 0 0-17a8.5 8.5 0 0 0 0 17"/><path d="m18 18l3 3"/></g></svg>`,
  duplicates: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15.5V8.8c0-2.72 0-4.08.844-4.925C7.689 3.03 9.048 3.03 11.766 3.03h3.01c2.718 0 4.077 0 4.922.845c.845.845.845 2.205.845 4.925v4.64c0 2.72 0 4.08-.845 4.925c-.845.845-2.204.845-4.922.845h-3.01"/><path d="M4 8.5c-.543.11-.953.296-1.286.63C2 9.844 2 10.99 2 13.283v3.91c0 2.293 0 3.44.714 4.153S4.574 22.06 6.866 22.06h4.04c2.292 0 3.438 0 4.152-.714c.334-.334.52-.744.63-1.286"/><path d="M10 8h6m-6 4h6m-6 4h3"/></g></svg>`,
  account: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20"/><path d="M15.5 9a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0"/><path d="M5.8 18.1c.9-2.05 2.78-3.1 6.2-3.1s5.3 1.05 6.2 3.1"/></g></svg>`,
} as const;

export type TabIcon2100Key = keyof typeof TAB_ICON_SVG_2100;
