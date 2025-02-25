import { extension_settings, getContext } from '../../../extensions.js';
import { saveChatDebounced, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { registerNicknamesSlashCommands } from './nicknamesSlashCommands.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

/** @enum {string} The context levels at which nicknames can be set */
export const ContextLevel = {
    /** Set to global level, per account */
    GLOBAL: 'global',
    /** Set to character level (only available for personas) */
    CHAR: 'char',
    /** Set to chat level (saved with the chat file) */
    CHAT: 'chat',
    /** No context level (no nickname, using normal name) */
    NONE: 'none',
};

/**
 * @typedef {Object} NicknameResult
 * @property {ContextLevel} context - The level at which this nickname is set
 * @property {string?} name - The nickname
 */

/**
 * Settings object containing nickname mappings.
 *
 * @typedef {Object} NicknameSettings
 * @property {Object} mappings - Collection of mappings between characters/personas and nicknames
 * @property {{[charKey: string]: { personas: {[personaKey: string]: string}}}} mappings.char - Mapping of character keys to persona nicknames.
 * @property {Object} mappings.global - Global mappings for personas and characters
 * @property {{[personaKey: string]: string}} mappings.global.personas - Mapping of persona keys to a character nickname.
 * @property {{[charKey: string]: string}} mappings.global.chars - Mapping of character keys to a persona nickname.
 */

/** @type {NicknameSettings} */
let settings = {
    mappings: {
        char: {},
        global: {
            personas: {},
            chars: {},
        },
    },
};

async function loadSettings() {
    const loadedSettings = extension_settings[SETTNGS_NAME];
    if (!loadedSettings) {
        return;
    }

    // Make sure all required objects exist
    loadedSettings.mappings ??= settings.mappings;
    loadedSettings.mappings.char ??= settings.mappings.char;
    loadedSettings.mappings.global ??= settings.mappings.global;
    loadedSettings.mappings.global.personas ??= settings.mappings.global.personas;
    loadedSettings.mappings.global.chars ??= settings.mappings.global.chars;

    settings = loadedSettings;
}

function getPersonaKey() {
    return user_avatar;
}

function getCharKey() {
    return getContext().characters[getContext().characterId]?.avatar;
}

/**
 * Gets the nickname for the user, or original name if none exist
 * @returns {string} The name
 */
function getUserNickname() {
    return handleNickname('user').name;
}

/**
 * Gets the nickname for the character, or original name if none exist
 * @returns {string} The name
 */
function getCharNickname() {
    return handleNickname('char').name;
}

/**
 * Handles nickname settings for the given type, in the given context.
 *
 * @param {'user'|'char'} type - Type of nickname to handle. Can be either 'user' or 'char'
 * @param {string?} [value=null] - Value to set the nickname to - If not given, the nickname will be read instead
 * @param {'chat'|'char'|'global'?} [forContext=null] - Context in which to handle the nickname - Can be 'chat', 'char', or 'global'. If not given, the first nickname found in the context in the specified order will be returned
 * @param {object} [options] - Optional arguments
 * @param {boolean} [options.reset=false] - If true, the nickname will be reset to its default value
 *
 * @returns {NicknameResult?} The nickname value after handling
 */
export function handleNickname(type, value = null, forContext = null, { reset = false } = {}) {
    value = value?.trim();

    if (forContext && !Object.values(ContextLevel).includes(forContext)) {
        throw new Error(`Unknown context: ${forContext}`);
    }
    if (!forContext && (value || reset)) {
        throw new Error('Can\'t set nickname or reset it without a context');
    }

    if (forContext === ContextLevel.CHAT || !forContext) {
        const metadata = getContext().chatMetadata[SETTNGS_NAME] ??= { personas: {}, chars: {} };

        const chatTypeKey = type === 'char' ? 'chars' : 'personas';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete metadata[chatTypeKey][nicknameKey];
            saveChatDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            metadata[chatTypeKey][nicknameKey] = value;
            saveChatDebounced();
            return { context: ContextLevel.CHAT, name: value };
        }
        // Return if set
        if (forContext || metadata[chatTypeKey][nicknameKey]) {
            return metadata[chatTypeKey][nicknameKey];
        }
    }

    if (forContext === ContextLevel.CHAR || !forContext) {
        if (type === 'char' && (value || reset)) {
            toastr.warning('Cannot set character nickname on character level', 'Nicknames');
            return null;
        }

        const charKey = getCharKey();
        const nicknameKey = getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.char[charKey]?.personas[nicknameKey];
            saveSettingsDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            settings.mappings.char[charKey] ??= { personas: {} };
            settings.mappings.char[charKey].personas[nicknameKey] = value;
            saveSettingsDebounced();
            return { context: ContextLevel.CHAR, name: value };
        }
        // Return if set
        if (forContext || settings.mappings.char[charKey]?.personas[nicknameKey]) {
            return { context: ContextLevel.CHAR, name: settings.mappings.char[charKey]?.personas[nicknameKey] };
        }
    }

    if (forContext === ContextLevel.GLOBAL || !forContext) {
        const globalTypeKey = type === 'char' ? 'chars' : 'personas';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.global[globalTypeKey][nicknameKey];
            saveSettingsDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            settings.mappings.global[globalTypeKey][nicknameKey] = value;
            saveSettingsDebounced();
            return { context: ContextLevel.GLOBAL, name: value };
        }
        // Return if set
        if (forContext || settings.mappings.global[globalTypeKey][nicknameKey]) {
            return { context: ContextLevel.GLOBAL, name: settings.mappings.global[globalTypeKey][nicknameKey] };
        }
    }

    // Default, if no nickname is set, just return the current default names
    return { context: ContextLevel.NONE, name: type === 'char' ? getContext().name2 : getContext().name1 };
}

function registerNicknameMacros() {
    getContext().registerMacro('user', getUserNickname);
    getContext().registerMacro('char', getCharNickname);
}

// This function is called when the extension is loaded
$(async () => {
    loadSettings();
    registerNicknamesSlashCommands();
    registerNicknameMacros();
});

