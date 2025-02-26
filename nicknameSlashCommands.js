import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { enumIcons } from '../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from '../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { ContextLevel, handleNickname } from './index.js';

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

export const RESET_NICKNAME_LABEL = '#reset';

export function registerNicknamesSlashCommands() {
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
