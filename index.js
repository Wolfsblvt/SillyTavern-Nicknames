import { extension_settings, getContext } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

let settings = {};

async function loadSettings() {
    extension_settings[SETTNGS_NAME] ??= {};
    settings = extension_settings[SETTNGS_NAME];
}


// This function is called when the extension is loaded
$(async () => {
    SillyTavern.getContext().registerMacro('user', 'Kazuma');
    SillyTavern.getContext().registerMacro('char', 'Megumin');

    loadSettings();
});
