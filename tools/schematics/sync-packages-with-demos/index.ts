import { chain, Rule, Tree, SchematicContext, SchematicsException, apply, url, move, mergeWith, template, noop } from '@angular-devkit/schematics';
import { stringUtils } from '@nrwl/workspace';
import { getJsonFromFile, sanitizeCollectionArgs, setPackageNamesToUpdate, setDemoTypes, SupportedDemoTypes, SupportedDemoType, getDemoTypes, getPackageNamesToUpdate, getDemoAppRoot, addDependencyToDemoApp, checkPackages, getDemoIndexInfoForType, getDemoIndexPathForType } from '../utils';
import { Schema } from './schema';

export default function (schema?: Schema, relativePrefix?: string): Rule {
	if (schema) {
		if (schema.types) {
			// only updating specific demo types
			const demoTypes = <Array<SupportedDemoType>>sanitizeCollectionArgs(schema.types);
			for (const t of demoTypes) {
				if (!SupportedDemoTypes.includes(t)) {
					throw new SchematicsException(`Can only update supported demo types: ${SupportedDemoTypes.join()}`);
				}
			}
			setDemoTypes(demoTypes);
		}
		if (schema.packages) {
			// only updating demo's for specific packages
			setPackageNamesToUpdate(sanitizeCollectionArgs(schema.packages).sort());
		}
	}
	const demoFileChains: Array<Rule> = [];
	const demoIndexChains: Array<Rule> = [];
	const demoDependencyChains: Array<Rule> = [];

	for (const t of getDemoTypes()) {
		const demoAppRoot = getDemoAppRoot(t);
		demoFileChains.push(addDemoFiles(t, demoAppRoot, relativePrefix));
		demoIndexChains.push(addToDemoIndex(t, demoAppRoot));
		demoDependencyChains.push(addDependencyToDemoApp(t, demoAppRoot));
	}

	return chain([prerun(), ...demoFileChains, ...demoIndexChains, ...demoDependencyChains]);
}

function prerun() {
	return (tree: Tree, context: SchematicContext) => {
		checkPackages(tree, context);
	};
}

function addDemoFiles(type: SupportedDemoType, demoAppRoot: string, relativePrefix: string = './') {
	return (tree: Tree, context: SchematicContext) => {
		context.logger.info(`Updating "${demoAppRoot}"`);
		let demoFolder = 'src/plugin-demos';
		const demoAppFolder = `${demoAppRoot}/${demoFolder}`;
		let viewExt = 'xml';
		// adjust folder location and viewExt dependent on demo type if needed
		switch (type) {
			case 'angular':
				viewExt = 'html';
				break;
		}
		const fileChain: Array<Rule> = [];
		for (const name of getPackageNamesToUpdate()) {
			const packageDemoViewPath = `${demoAppFolder}/${name}.${viewExt}`;
			// context.logger.info('packageDemoViewPath: ' + packageDemoViewPath);
			if (!tree.exists(packageDemoViewPath)) {
				// context.logger.info('packageDemoViewPath: DID NOT EXIST!');
				const templateSource = apply(url(`${relativePrefix}files_${type}`), [
					template({
						name,
						stringUtils,
						tmpl: '',
						dot: '.',
					}),
					move(demoAppFolder),
				]);

				fileChain.push(mergeWith(templateSource));
			} else {
				fileChain.push(noop());
			}
		}

		return chain(fileChain)(tree, context);
	};
}

function addToDemoIndex(type: SupportedDemoType, demoAppRoot: string) {
	return (tree: Tree, context: SchematicContext) => {
		checkPackages(tree, context);

		const demoIndexViewPath = `${demoAppRoot}/${getDemoIndexPathForType(type)}`;
		let indexViewContent = tree.read(demoIndexViewPath).toString('utf-8');
		// adjust index view app path dependent on demo type
		for (const name of getPackageNamesToUpdate()) {
			switch (type) {
				case 'angular':
					//   if (indexViewContent.indexOf(`name: '${name}'`) === -1) {
					//     // get index of last view-demo button
					//     const lastEntryIndex = indexViewContent.lastIndexOf(`},`);
					//     // get final content after that last button
					//     const remainingContent = indexViewContent.substr(lastEntryIndex, indexViewContent.length);
					//     // get first line break to determine position of where to insert next button
					//     const firstLB = remainingContent.indexOf('\n');
					//     const endingContent = indexViewContent.substring(lastEntryIndex + firstLB, indexViewContent.length);
					//     const buttonMarkup = `${buttonStart} ${buttonTap} ${buttonClass}${buttonEnd}`;
					//     // context.logger.info('buttonMarkup: ' + buttonMarkup);
					//     indexViewContent = indexViewContent.substring(0, lastEntryIndex + firstLB) + `\n${buttonMarkup}` + endingContent;
					//   }
					break;
				default:
					const { buttonMarkup } = getDemoIndexInfoForType(type, name);

					if (indexViewContent.indexOf(`Button text="${name}"`) === -1) {
						// get index of last view-demo button
						const lastBtnLocatorIndex = indexViewContent.lastIndexOf('view-demo');
						// get final content after that last button
						const remainingContent = indexViewContent.substr(lastBtnLocatorIndex, indexViewContent.length);
						// get first line break to determine position of where to insert next button
						const firstLB = remainingContent.indexOf('\n');
						const endingContent = indexViewContent.substring(lastBtnLocatorIndex + firstLB, indexViewContent.length);
						// context.logger.info('buttonMarkup: ' + buttonMarkup);
						indexViewContent = indexViewContent.substring(0, lastBtnLocatorIndex + firstLB) + `\n${buttonMarkup}` + endingContent;
					}

					break;
			}
		}
		// context.logger.info(indexViewContent);
		tree.overwrite(demoIndexViewPath, indexViewContent);
		return tree;
	};
}
