import { en } from './en';
import { vi } from './vi';
import type { Locale } from '../locales';
import type { Dict } from './en';

export const dictionaries: Record<Locale, Dict> = { en, vi };
export type { Dict };
