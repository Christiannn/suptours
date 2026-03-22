<script lang="ts">
	import TourForm from '$lib/tours/TourForm.svelte';

	let { data, form } = $props();
</script>

<TourForm {form} availableTeams={data.availableTeams} />
