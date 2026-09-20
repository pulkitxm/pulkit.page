export interface SiteLink {
  label: string;
  href: string;
}

export interface PageMetadata {
  title: string;
  description?: string;
  layout?: string;
  date?: string;
  role?: string;
  period?: string;
  endDate?: string;
  icon?: string;
  darkIcon?: string;
  secondaryIcon?: string;
  tags?: string[];
}

export interface ListedPage {
  route: string;
  index?: boolean;
  metadata: PageMetadata;
}

export interface PageRecord extends ListedPage {
  body: string;
}

export interface Page extends PageRecord {
  source: string;
  text: string;
  index: boolean;
}

export interface SiteSettings {
  brand?: string;
  wordmark?: string;
  description?: string;
  copyright?: string;
  navigation?: SiteLink[];
  social?: SiteLink[];
  articles?: string;
}

export interface ListedProject {
  name: string;
  url: string;
  description?: string;
  stars: number;
  site?: string;
}

export interface ProjectList {
  description: string;
  projects: ListedProject[];
}

export interface SiteContext extends SiteSettings {
  url?: string;
  author?: string;
  authorUrl?: string;
  external?: Record<string, ListedPage[]>;
  projects?: Record<string, ProjectList>;
}

export interface Site extends SiteContext {
  url: string;
}

export type Layouts = Map<string, string>;

export interface SiteInventory {
  pages: Page[];
  layouts: Layouts;
  site: Site;
}

export type Environment = Readonly<Record<string, string | undefined>>;
