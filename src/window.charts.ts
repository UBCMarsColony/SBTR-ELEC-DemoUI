import { Dataset, Dataseries } from "./models/data.model";
// @ts-ignore
import reactor_data from './reactor.data';

import * as primary from "./chart.primary";
import * as popped from "./chart.popped";
export { primary, popped };

/*
 * chart_options is an array of name-id pairs.
 */
export function init_charts()
{
	primary.init();
}

/* Author: Thomas Richmond
 * Description: Populates the chart selector with a nested-style list
 *				encompassing each dataset in the reactor_data.json resource file.
 *				The list automatically accomodates new entries into this file.
 * Purpose: datasets [Array<Dataset>] - All plottable datasets. Note: For this to
 *										work properly, each dataset and associated
 *										dataseries must have a name and ID.
 */
export function init_selector(datasets: Array<Dataset>)
{
	// Get the HTML selector element. We will populate its fields below.
	const plot_selector = document.getElementById('dataplot-selector-preset') as HTMLSelectElement; 
	
	// Iterate over every dataset in the provided array.
	// Each dataset and all of its series will be added to the selector.
	for (let dset of datasets)
	{
		// The "primary" option corresponds to the entire dataset. When selected, all dataseries
		// within the dataset are shown on the plot.
		plot_selector.innerHTML +=
			"<option class='set' value='" + dset.id + "'>" + dset.name + "</option>"
		
		// Iterate over each series within the dataset
		for (let dser of dset.series)
			// The 'secondary' options correspond to the indiviudal series within a dataset. When selected,
			// that dataseries will be shown on the plot.
			plot_selector.innerHTML +=
				"<option class='series' value='" + dset.id + ":" + dser.id + "'>&nbsp;" + dser.name + "</option>";
	}
}

/* Author: Thomas Richmond
 * Description: 
 * Parameters: selector [HTMLSelectElement] - The element which implements the callback
 */
export function select(selector: HTMLSelectElement)
{
	// Retrieve and parse the datakey as follows:
	// 	- The number before the colon is the dataset ID, and is required; 
	//	- The number after the colon is the dataseries ID, and is optional.
	// Example: "4:12,16"
	//           ^  ^
	//			 |  The dataseries to show
	//			 The dataset to show
	const datakey = selector.options[selector.selectedIndex].value.split(':');
	let dataset: Dataset;  // Before the colon
	let series: Array<number>;  // After the colon
	
	// Extract the dataset ID
	if (datakey[0] == undefined)
		throw new Error("Selector was unable to find a dataset associated with element: " + selector.innerHTML)
	dataset = reactor_data.datasets.find((dset: Dataset) => dset.id === Number(datakey[0]));
	
	// Check to see if there are dataseries. If there are, convert them to an array.
	if (datakey[1] != undefined)
		series = datakey[1].split(',').map(Number);

	// Select the new data using the builtin method
	// If no series were specified, that field remains undefined, and is subsequently ignored by the function.
	primary.select(dataset, series);
	
	// Highlights the selected option while turning off all other selected options
	for (let i = 0; i < selector.options.length; i++)
		selector.options[i].id =
			i === selector.selectedIndex ? "selected" : "";

	// This ensures the selector always shows the 'Select Plot' text rather than the last selection.
	selector.value = "title";
}