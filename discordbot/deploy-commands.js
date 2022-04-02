const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');
const commands = [
	new SlashCommandBuilder().setName('mona').setDescription('Tester la connection à Mona.'),
	new SlashCommandBuilder().setName('meteo').setDescription('Donne la météo du département français choisi.')
    .addStringOption(option =>
		option.setName('zipcode')
			.setDescription('Votre numéro de département.')
			.setRequired(true)),
	new SlashCommandBuilder().setName('pain').setDescription("Envoie du pain dans le chat (très français, oui !"),
	new SlashCommandBuilder().setName('actus').setDescription("Résumé des actus venant de plusieurs sources.")

]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);



