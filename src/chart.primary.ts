import { Dataset, Datapoint } from "./models/data.model";
import Chart from "chart.js";

const MICRO_TIME_SPAN = 15;
const CONVOLVER_STRENGTH = 0.20

// This is used to color the dataseries of the plot
const colors = ["#00AAAA", "#FF0000", "#0000FF", "#B8860B"];


export let micro: Chart = null;
export let macro: Chart = null;
export let current_plot: string = null;

export function init() {
	// TODO Figure out what type LegendItem has
	function legend_click_handler(e: Event, legendItem: Chart.ChartLegendLabelItem) {
		function toggle_series(chart: Chart) {
			let index = legendItem.datasetIndex;
			let meta = chart.getDatasetMeta(index);

			// See controller.isDatasetVisible comment
			meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
			
			// We hid a dataset ... rerender the chart
			chart.update();
		}
		toggle_series(micro);
		toggle_series(macro);
	}
	
	micro = new Chart(
		document.getElementById("dataplot-micro") as HTMLCanvasElement, {
		type: 'scatter',
		// Set 'data' in charts.select()
		data: {
			datasets: []
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			title: {
				display: false,
				text: "Micro"
				// Set 'text' in 'charts.select()'
			},
			scales: {
				xAxes: [{
					type: 'linear',
					position: 'bottom',
				}],
				yAxes: [
					{
						type: 'linear',
						position: 'right',
						ticks: {suggestedMin: 0},
						scaleLabel: {display: true}
						// Set 'text' in charts.select()
					},
					{
						position: 'left',
						ticks: {display: false},
						gridLines: {display: false},
						scaleLabel: {
							display: true,
							labelString: "Micro"
						}
					},
				]
			},			
			legend: {
				position: 'bottom',
				onClick: legend_click_handler
			},
			animation: {
				duration: 0
			}
		}
	});
	macro = new Chart(
		document.getElementById("dataplot-macro") as HTMLCanvasElement,  {
		type: 'scatter',
		// Set 'data' in charts.select()
		data: {
			datasets: []
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			title: {
				display: false,
				text: "Macro"
				// Set 'text' in 'charts.select()'
			},
			scales: {
				xAxes: [{
					type: 'linear',
					position: 'bottom',
					ticks: {suggestedMin: 0},
					scaleLabel: {display: true}
				}],
				yAxes: [
					{
						type: 'linear',
						position: 'right',
						ticks: {suggestedMin: 0},
						scaleLabel: {display: true}
					},
					{
						position: "left",
						ticks: {display: false},
						gridLines: {display: false},
						scaleLabel: {
							display: true,
							labelString: "Macro"
						}
					},
				]
			},			
			legend: {
				display: false
			},
			animation: {
				duration: 0
			}
		}
	});
}


/*
 * 	new_data: A datatype object. Each datatype contains:
 *				- name
 * 				- ID
 *				- array of datasets
 *			  Each dataset contains:
 *			  	- name
 *				- ID
 *				- new data
 */
export function update(dataset: Dataset) {
	if (current_plot !== dataset.name)
		return;
	
	// Append data to the plots
	for (let series of dataset.series)
	{	
		let i = macro.data.datasets.findIndex((ds) => ds.label === series.name);
		if (i === -1)
			break;

		const mapped_data = series.data
			.map((dp: Datapoint) => ({x: dp.time, y: dp.value}) as Chart.ChartPoint)
			.filter((cp: Chart.ChartPoint) => cp.x != undefined && cp.y != undefined);
		// @ts-ignore
		macro.data.datasets[i].data = macro.data.datasets[i].data.concat(mapped_data);
		// @ts-ignore
		micro.data.datasets[i].data = micro.data.datasets[i].data.concat(mapped_data);
	}
	
	// Make the x-axis max scale consistently
	let max_xval = 0;
	for (let series of micro.data.datasets)
		if ((series.data[series.data.length - 1] as Chart.ChartPoint).x as number > max_xval)
			max_xval = (series.data[series.data.length - 1] as Chart.ChartPoint).x as number;
	
	macro.options.scales.xAxes[0].ticks.suggestedMax = Math.ceil(max_xval / 1.4);
	micro.options.scales.xAxes[0].ticks.suggestedMax = Math.ceil(max_xval * 1.4);
	
	// Convolute the macro-scale plot data so we don't keep re-rendering a ton of data
	convolve_chart(macro, CONVOLVER_STRENGTH);
	
	// Cut off the micro-scale plot
	// 1. Make sure the axis scales consistently
	const micro_cutoff = Math.ceil(max_xval / 2) * 2 - Math.floor(MICRO_TIME_SPAN / 2) * 2;
	micro.options.scales.xAxes[0].ticks.suggestedMin = (micro_cutoff > 0 ? micro_cutoff : 0);
	// Filter values to those in the desired range
	for (let i = 0; i < micro.data.datasets.length; i++)
		micro.data.datasets[i].data =
			// Typescript doesn't like the filter call.
			// @ts-ignore
			micro.data.datasets[i].data.filter((dp: Chart.ChartPoint) => dp.x > micro_cutoff);
	
	// Push the update to the screen
	micro.update();
	macro.update();
}

// Author: Thomas Richmond
// Purpose: Called whenever the user selects a new data set or series to plot on the charts.
// 			The function handles the switching and convolutions of data.
// Parameters: 	dataset [Dataset] - The dataset to display (i.e. temperature, flow rate...)
//				show_ids [Array<number>] - If set, specifies the IDs of datasets to show.
export function select(dataset: Dataset, show_ids?: Array<number>)
{
	// We need to do a bunch of configuration for each chart. Thus, we make a method
	// that can be used by both charts.
	function configure_chart(chart: Chart) {
		// Clear any data that is currently being drawn on the plot. 
		chart.data.datasets = [];  // Don't do .length = 0, as this may clear the actual dataset
		
		// Iterate over the dataset we have been given and insert each series into the plot with formatting.
		for (let i = 0; i < dataset.series.length; i++)
		{
			// The chart data is inserted and formatted as follows:
			chart.data.datasets[i] =
			{
				// The data itself is injected into the plot
				label: dataset.series[i].name,
				data: dataset.series[i].data.map((d: Datapoint) => ({x: d.time, y: d.value}) as Chart.ChartPoint),
				// The datapoints are formatted in a consistent way
				radius: 1,
				backgroundColor: colors[i],  // Point color
				// The Bezier curves connecting the datapoints is formatted in a consistent way
				showLine: true,
				borderWidth: 1,  // Line width
				borderColor: colors[i],
				fill: false,  // Don't fill the space under the curve
			};
			
			// If the show_ids parameter is not undefined, we should only show a subset of these series.
			if (show_ids != undefined)
				chart.data.datasets[i].hidden =
					show_ids.some((id: number) => id !== dataset.series[i].id)
			
			// Set the axes for the charts based on the data we are using
			chart.options.scales.xAxes[0].scaleLabel.labelString = 'Time [s]';
			chart.options.scales.yAxes[0].scaleLabel.labelString = '[' + dataset.units + ']';
		}
	};
	
	// Using the function we defined above, inject the selected data into the charts.
	configure_chart(macro);
	configure_chart(micro);
	
	// Handle a few last things:
	// 1. Reduce the amount of data contained in the macro-scale plot by convoluting it
	convolve_chart(macro, CONVOLVER_STRENGTH)
	// 2. Ensure the charts refresh immediately to show this update
	macro.update();
	micro.update();
	// 3. Update the title label for the plots with the name of the dataset.
	document.getElementById("dataplot-title").innerHTML = dataset.name;
	
	// Update the global parameter describing what's currently being shown
	current_plot = dataset.name;
}

/*
 * Author: Thomas Richmond
 * Purpose: Reduce the number of datapoints in the chart such that we
 *	    retain as few points as needed while still indicating the
 *	    plot behaviour. For instance, the sequential values 
 *	    { 0.9, 1.1, 1.05, 1.02, 0.95 } may as well be represented by
 *	    a single datapoint (~1) and we can let a bezier curve fit the
 *	    rest of the the data.
 * Parameters:  chart [Chart] - The chart whose data you wish to convolute
 *		strength [number] - The maximum percent error between datapoints
 *				    for which data will be convolved.
 *				    Value must be positive.
 */
function convolve_chart(chart: Chart, strength: number)
{
	if (strength < 0)
		throw new RangeError("Convolver strength cannot be less than zero!");
	
	for (let i = 0; i < chart.data.datasets.length; i++)
	{
		// Create a convolution buffer so that we can delete data 
		// without affecting the chart object
		let conv_buffer = macro.data.datasets[i].data;
		
		// Loop over the entire dataset, excluding the most recent element,
		// in reverse order and three elements at a time. 
		for (let n = conv_buffer.length - 1; n > 3; n--)
		{
			// Get three neighboring elements of the array.
			// We only care about their y-values, so extract those.
			const [x3, x2, x1] = conv_buffer.slice(n - 3, n)
				// @ts-ignore
				.map((dp: Chart.ChartPoint) => dp.y as number);
			
			// Convolute the data:
			// 	If the percent difference of x3 and x1 is within the convolver strength, 
			// 	then we consider x2 as being unimportant to the overall trend of the data.
			if (Math.abs(x1 - x3) / (Math.abs(x1)/2 + Math.abs(x3)/2) < strength)
				conv_buffer.splice(n - 2, 1);
		}
		
		// Repopulate the chart series with the convolved data.
		chart.data.datasets[i].data = conv_buffer;
	}
}
