import { extension_settings, getContext } from '../../../extensions.js';
import { saveChatDebounced, saveSettingsDebounced, user_avatar } from '../../../../script.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';

/** @type {string} Field name for the this extensions settings */
const SETTNGS_NAME = 'nicknames';

let settings = {
    mappings: {
        char: {
            /** @type {{[personaKey: string]: string}} Mapping of persona keys to a char nickname */
            personas: {},
        },
        global: {
            /** @type {{[personaKey: string]: string}} Mapping of persona keys to a char nickname */
            personas: {},
            /** @type {{[charKey: string]: string}} Mapping of char keys to a persona nickname */
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
    loadedSettings.mappings.char.personas ??= settings.mappings.char.personas;
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

function getUserNickname() {
    return handleNickname('user');
}

function getCharNickname() {
    return handleNickname('char');
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
 * @returns {string} The nickname value after handling
 */
function handleNickname(type, value = null, forContext = null, { reset = false } = {}) {
    value = value?.trim();

    if (forContext && !['chat', 'char', 'global'].includes(forContext)) {
        throw new Error(`Unknown context: ${forContext}`);
    }
    if (!forContext && (value || reset)) {
        throw new Error('Can\'t set nickanme or reset it without a context');
    }

    if (forContext === 'chat' || !forContext) {
        const metadata = getContext().chatMetadata[SETTNGS_NAME] ??= { chars: {}, personas: {} };
        const chatTypeKey = type === 'char' ? 'personas' : 'chars';

        // Reset -> return
        if (reset) {
            delete metadata[chatTypeKey][type];
            saveChatDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            metadata[chatTypeKey][type] = value;
            saveChatDebounced();
            return value;
        }
        // Return if set
        if (forContext || metadata[chatTypeKey][type]) {
            return metadata[chatTypeKey][type];
        }
    }

    if (forContext === 'char' || !forContext) {
        if (type === 'char' && (value || reset)) {
            toastr.warning('Cannot set character nickname on character level', 'Nicknames');
            return '';
        }

        const nicknameKey = getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.char.personas[nicknameKey];
            saveSettingsDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            settings.mappings.char.personas[nicknameKey] = value;
            saveSettingsDebounced();
            return value;
        }
        // Return if set
        if (forContext || settings.mappings.char.personas[nicknameKey]) {
            return settings.mappings.char.personas[nicknameKey];
        }
    }

    if (forContext === 'global' || !forContext) {
        const globalTypeKey = type === 'char' ? 'personas' : 'chars';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.global[globalTypeKey][nicknameKey];
            saveSettingsDebounced();
            return '';
        }
        // Set -> return
        if (value) {
            settings.mappings.global[globalTypeKey][nicknameKey] = value;
            saveSettingsDebounced();
            return value;
        }
        // Return if set
        if (forContext || settings.mappings.global[globalTypeKey][nicknameKey]) {
            return settings.mappings.global[globalTypeKey][nicknameKey];
        }
    }

    // Default, if no nickname is set, just return the current default names
    return type === 'char' ? getContext().name2 : getContext().name1;
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameUserCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('user', nickname, args.for || 'chat');
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameCharCallback(args, nickname) {
    if (args.for && !['chat', 'char', 'global'].includes(args.for)) {
        toastr.error(`Unknown context: ${args.for}`, 'Nicknames');
        return '';
    }
    return handleNickname('char', nickname, args.for || 'chat');
}

function registerNicknamesSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-user',
        callback: nicknameUserCallback,
        returns: 'nickname of the current user',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'At which context the nickname should be set',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'char', 'global'],
                forceEnum: true,
                defaultValue: 'chat',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'the nickname',
                typeList: [ARGUMENT_TYPE.STRING],
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
                description: 'At which context the nickname should be set',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: ['chat', 'user', 'global'],
                forceEnum: true,
                defaultValue: 'chat',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'the nickname',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: 'Sets the nickname of the current character - or ',
    }));
}

// This function is called when the extension is loaded
$(async () => {
    getContext().registerMacro('user', getUserNickname);
    getContext().registerMacro('char', getCharNickname);

    loadSettings();
    registerNicknamesSlashCommands();
});
