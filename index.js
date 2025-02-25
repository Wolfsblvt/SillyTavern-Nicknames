import { extension_settings, getContext } from '../../../extensions.js';
import { saveChatDebounced, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { enumIcons } from '../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from '../../../slash-commands/SlashCommandEnumValue.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

/** @enum {string} The context levels at which nicknames can be set */
const ContextLevel = {
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
function handleNickname(type, value = null, forContext = null, { reset = false } = {}) {
    value = value?.trim();

    if (forContext && !Object.values(ContextLevel).includes(forContext)) {
        throw new Error(`Unknown context: ${forContext}`);
    }
    if (!forContext && (value || reset)) {
        throw new Error('Can\'t set nickname or reset it without a context');
    }

    if (forContext === ContextLevel.CHAT || !forContext) {
        const metadata = getContext().chatMetadata[SETTNGS_NAME] ??= { chars: {}, personas: {} };
        const chatTypeKey = type === 'char' ? 'personas' : 'chars';

        // Reset -> return
        if (reset) {
            delete metadata[chatTypeKey][type];
            saveChatDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            metadata[chatTypeKey][type] = value;
            saveChatDebounced();
            return { context: ContextLevel.CHAT, name: value };
        }
        // Return if set
        if (forContext || metadata[chatTypeKey][type]) {
            return metadata[chatTypeKey][type];
        }
    }

    if (forContext === ContextLevel.CHAR || !forContext) {
        if (type === 'char' && (value || reset)) {
            toastr.warning('Cannot set character nickname on character level', 'Nicknames');
            return null;
        }

        const charKey = getCharKey();
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

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
        const globalTypeKey = type === 'char' ? 'personas' : 'chars';
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

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameUserCallback(args, nickname) {
    try {
        return handleNickname('user', nickname, args.for, { reset: nickname === RESET_NICKNAME_LABEL })?.name ?? '';
    } catch (error) {
        toastr.error(`Error: ${error.message}`, 'Nicknames');
        return '';
    }
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameCharCallback(args, nickname) {
    try {
        return handleNickname('char', nickname, args.for, { reset: nickname === RESET_NICKNAME_LABEL })?.name ?? '';
    } catch (error) {
        toastr.error(`Error: ${error.message}`, 'Nicknames');
        return '';
    }
}

const RESET_NICKNAME_LABEL = '#reset';

function registerNicknamesSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-user',
        aliases: ['nickname-persona'],
        callback: nicknameUserCallback,
        returns: 'nickname of the current user',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(ContextLevel.GLOBAL, null, enumTypes.namedArgument, 'G'),
                    new SlashCommandEnumValue(ContextLevel.CHAR, null, enumTypes.enum, enumIcons.character),
                    new SlashCommandEnumValue(ContextLevel.CHAT, null, enumTypes.enum, enumIcons.message),
                ],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The nickname to set (or \'#reset\' to remove the nickname)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(RESET_NICKNAME_LABEL, 'Resets the nickname (removing it from this context)', enumTypes.enum, '❌'),
                    new SlashCommandEnumValue(
                        'a nickname',
                        null,
                        enumTypes.name,
                        enumIcons.default,
                        (input) => /^[\w\w]*$/.test(input),
                        (input) => input,
                    ),
                ],
            }),
        ],
        helpString: 'Sets the nickname of the current user - or ',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-char',
        callback: nicknameCharCallback,
        returns: 'nickname of the current character',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(ContextLevel.GLOBAL, null, enumTypes.namedArgument, 'G'),
                    new SlashCommandEnumValue(ContextLevel.CHAR, null, enumTypes.enum, enumIcons.character),
                    new SlashCommandEnumValue(ContextLevel.CHAT, null, enumTypes.enum, enumIcons.message),
                ],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The nickname to set (or \'#reset\' to remove the nickname)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(RESET_NICKNAME_LABEL, 'Resets the nickname (removing it from this context)', enumTypes.enum, '❌'),
                    new SlashCommandEnumValue(
                        'a nickname',
                        null,
                        enumTypes.name,
                        enumIcons.default,
                        (input) => /^[\w\w]*$/.test(input),
                        (input) => input,
                    ),
                ],
            }),
        ],
        helpString: 'Sets the nickname of the current character - or ',
    }));
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

