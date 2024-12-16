/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { map, upperCase } from 'lodash';
import zhCN from '../../locale/languages/zh-cn.json';

export const SupportedLocales =  {
  'English': 'en-US',
  'Français': 'fr-FR',
  '简体中文': 'zh-CN',
  '日本語': 'ja-JP',
  'Português': 'pt-BR',
  'Español': 'es-ES',
  'Русский': 'ru-RU',
  'Deutsch': 'de-DE',
  'Hebrew': 'he-HE',
  'Nederlands': 'nl-NL',
}

export const languageSelectOptions = map(SupportedLocales, (value, key) => ({
  label: `${key} - ${upperCase(value.split('-')[0])}`,
  key: value,
}));

// Returns i18next options
export const getInitOptions = () => {
  return {
    supportedLngs: Object.values(SupportedLocales),
    resources: {
      'zh-CN': { translation: zhCN }
    },
    fallbackLng: ['zh-CN'],
    detection: {
      order: ['cookie'],
      caches: ['cookie'], // cache user language on
    },
    interpolation: {
      escapeValue: false, // XSS safety provided by React
    },
    missingKeyHandler: (_lngs, _ns, key) =>
      // eslint-disable-next-line no-console
      console.error(`i18next: key not found "${key}"`),
    saveMissing: true, // Required for missing key handler
  };
};
