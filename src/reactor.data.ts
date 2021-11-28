import { DATA_SPEC, Dataset, Dataseries, Datapoint } from "./models/data.model";

const reactor_data = {
	datasets: DATA_SPEC,
	
	update: function(update_dataset: Dataset) {
		
		const set_index = reactor_data.datasets.findIndex((dset: Dataset) => dset.id === update_dataset.id);
		if (set_index === -1)  // No matching dataset found; Exit function
			return;
		
		// Iterate over the incoming series data
		update_dataset.series.forEach(update_series => {
			// Check for a matching data series
			const series_index = reactor_data.datasets[set_index].series.findIndex(
				(series: Dataseries) => series.id === update_series.id);
			if (series_index === -1)  // No match found; Go to next iteration
				return;
			
			// Concatenate the new data to the dataset
			reactor_data.datasets[set_index].series[series_index].data =
				reactor_data.datasets[set_index].series[series_index].data.concat(update_series.data);
		});
	},
	
	to_csv: function(dataset: number | Dataset) {
		if (typeof dataset === "number")
		{
			dataset = this.datasets.find((dset: Dataset) => dset.id === dataset);
			if (!dataset)
				return false;
		}
		
		// Stub
	},
	
	clear_half: function(dataset: number) {
		// Stub
	},

	add_to_data_set: function(dataset: string, seriesName: string, data: Datapoint){
		reactor_data.datasets.find(set => set.name === dataset).series.find(series => series.name === seriesName).data.push(data);
	}
};

export default reactor_data;
