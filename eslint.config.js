import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';

export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				NodeJS: 'readonly'
			}
		},
		rules: {
			'no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
			],
			// Stricter rules added in eslint-plugin-svelte v3 — pre-existing patterns flagged across the codebase.
			// Re-enable and address incrementally.
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/require-each-key': 'off',
			'svelte/no-reactive-functions': 'off',
			'svelte/no-useless-mustaches': 'off',
			'svelte/no-at-html-tags': 'off'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser
			}
		}
	},
	{
		ignores: [
			'.svelte-kit/**',
			'.slicemachine/**',
			'.netlify/**',
			'build/**',
			'dist/**',
			'node_modules/**',
			'static/**',
			'customtypes/**',
			'src/prismicio-types.d.ts',
			'**/*.ts'
		]
	}
];
