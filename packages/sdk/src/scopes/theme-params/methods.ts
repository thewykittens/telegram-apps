import {
  off,
  on,
  type EventListener,
  type RGB,
  type ThemeParams,
} from '@telegram-apps/bridge';
import { isPageReload } from '@telegram-apps/navigation';
import { camelToKebab, getStorageValue, setStorageValue } from '@telegram-apps/toolkit';

import { deleteCssVar, setCssVar } from '@/utils/css-vars.js';
import { ERR_CSS_VARS_BOUND } from '@/errors/errors.js';
import { SDKError } from '@/errors/SDKError.js';
import { retrieve as retrieveLaunchParams } from '@/scopes/launch-params/static.js';

import { isCssVarsBound, state, isMounted } from './signals.js';
import { type GetCssVarNameFn, parse } from './static.js';

type StorageValue = ThemeParams;

const STORAGE_KEY = 'themeParams';
const THEME_CHANGED_EVENT = 'theme_changed';

/**
 * Creates CSS variables connected with the current theme parameters.
 *
 * By default, created CSS variables names are following the pattern "--tg-theme-{name}", where
 * {name} is a theme parameters key name converted from camel case to kebab case.
 *
 * Default variables:
 * - `--tg-theme-bg-color`
 * - `--tg-theme-secondary-text-color`
 *
 * Variables are being automatically updated if theme parameters were changed.
 *
 * @param getCSSVarName - function, returning complete CSS variable name for the specified
 * theme parameters key.
 * @returns Function to stop updating variables.
 */
export function bindCssVars(getCSSVarName?: GetCssVarNameFn): VoidFunction {
  if (isCssVarsBound()) {
    throw new SDKError(ERR_CSS_VARS_BOUND);
  }
  getCSSVarName ||= (prop) => `--tg-theme-${camelToKebab(prop)}`;

  function forEachEntry(fn: (key: string, value: RGB) => void): void {
    Object.entries(state()).forEach(([k, v]) => {
      v && fn(k, v);
    });
  }

  function actualize(): void {
    forEachEntry((k, v) => {
      setCssVar(getCSSVarName!(k), v);
    });
  }

  actualize();
  state.sub(actualize);
  isCssVarsBound.set(true);

  return () => {
    forEachEntry(deleteCssVar);
    state.unsub(actualize);
    isCssVarsBound.set(false);
  };
}

/**
 * Mounts the component.
 *
 * This function restores the component state and is automatically saving it in the local storage
 * if it changed.
 */
export function mount(): void {
  if (!isMounted()) {
    on(THEME_CHANGED_EVENT, onThemeChanged);
    state.set(isPageReload() && getStorageValue<StorageValue>(STORAGE_KEY) || retrieveLaunchParams().themeParams);
    isMounted.set(true);
  }
}

/**
 * Actualizes the theme parameters whenever an according event was received.
 * @param e - event data.
 */
const onThemeChanged: EventListener<'theme_changed'> = (e) => {
  const value = parse(e.theme_params);
  state.set(value);
  setStorageValue<StorageValue>(STORAGE_KEY, value);
};

/**
 * Unmounts the component, removing the listener, saving the component state in the local storage.
 */
export function unmount(): void {
  off(THEME_CHANGED_EVENT, onThemeChanged);
  isMounted.set(false);
}
