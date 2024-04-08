import "@mantine/core/styles.css";
import "@mantine/dates/styles.css"; //if using mantine date picker features
import "mantine-react-table/styles.css"; //make sure MRT styles were imported in your app root (once)
import { use, useEffect, useMemo, useState } from "react";
import {
  MantineReactTable,
  type MRT_ColumnDef,
  useMantineReactTable,
} from "mantine-react-table";
import { Stack, Title, Button, TextInput, Box, Group } from "@mantine/core";
import { modals } from "@mantine/modals";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useSession } from "next-auth/react";
import { useForm } from "@mantine/form";
import { showNotification } from "@mantine/notifications";

type TimeSlot = {
  availability_id: number;
  trainer_username: string;
  is_booked: boolean;
  begin_time: string;
  end_time: string;
  fee: number;
};

export default function TrainersAvailabilityTable() {
  return (
    <Stack gap="sm" align="center">
      <Title order={2} c="rgb(73, 105, 137)" ta="center">
        Available Time Slots for All Trainers
      </Title>
      <AvailabilityTable />
    </Stack>
  );
}

const AvailabilityTable = () => {
  const columns = useMemo<MRT_ColumnDef<TimeSlot>[]>(
    () => [
      {
        accessorKey: "trainer_username",
        header: "Trainer",
      },
      {
        accessorKey: "begin_time",
        header: "Begin Time",
      },
      {
        accessorKey: "end_time",
        header: "End Time",
      },
      {
        accessorKey: "fee",
        header: "Booking Fee",
      },
    ],
    []
  );

  const queryClient = useQueryClient();

  //call READ hook
  const {
    data: fetchedTimeSlots = [],
    isError: isLoadingTimeSlotsError,
    isFetching: isFetchingTimeSlots,
    isLoading: isLoadingTimeSlots,
  } = useGetTimeSlots();

  const table = useMantineReactTable({
    columns,
    data: fetchedTimeSlots,
    createDisplayMode: "row", // ('modal', and 'custom' are also available)
    enableEditing: false,
    enableRowSelection: (row) => row.original.is_booked == false,
    enableMultiRowSelection: false, //shows radio buttons instead of checkboxes
    // getRowId: (row) => row.availability_id.toString(),
    mantineToolbarAlertBannerProps: isLoadingTimeSlotsError
      ? {
          color: "red",
          children: "Error loading data",
        }
      : undefined,
    mantineTableContainerProps: {
      style: {
        minHeight: "500px",
      },
    },
    state: {
      isLoading: isLoadingTimeSlots,
      showAlertBanner: isLoadingTimeSlotsError,
      showProgressBars: isFetchingTimeSlots,
    },
    renderTopToolbarCustomActions: ({ table }) => {
      // Check if any rows are selected
      const isRowSelected = table.getSelectedRowModel().rows.length > 0;

      return (
        <Button
          onClick={handleBookSelected}
          // Disable the button if no rows are selected
          disabled={!isRowSelected}
        >
          Book Selected Time Slot
        </Button>
      );
    },
  });

  // After press the button
  const { data: session } = useSession();

  const handleDescriptionSubmitted = async (description: string) => {
    const member_username = session?.user?.username;
    const selectedRow = table.getSelectedRowModel().rows[0]; //or read entire rows
    const availability_id = selectedRow.original.availability_id;
    const trainer_username = selectedRow.original.trainer_username;
    const begin_time = selectedRow.original.begin_time;
    const end_time = selectedRow.original.end_time;

    const dataToSend = {
      member_username,
      availability_id,
      description,
      trainer_username,
      begin_time,
      end_time,
    };

    try {
      const response = await fetch("/api/member/personal-training/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        modals.closeAll();

        // Show success notification
        showNotification({
          title: "Success",
          message: "Booking successful!",
          color: "green",
        });

        await queryClient.invalidateQueries();
        table.toggleAllRowsSelected(false);
      } else {
        console.error("Error submitting data:", response.statusText);
        // Show error notification
        showNotification({
          title: "Error",
          message: "Failed to book. Please try again.",
          color: "red",
        });
      }
    } catch (error) {
      console.error("Network error:", error);
      // Show error notification
      showNotification({
        title: "Network Error",
        message: "Please check your connection and try again.",
        color: "red",
      });
    }
  };

  function DescriptionForm() {
    const form = useForm({
      initialValues: {
        description: "",
      },
    });

    return (
      <Box mx="auto">
        <form
          onSubmit={form.onSubmit((values) =>
            handleDescriptionSubmitted(values.description)
          )}
        >
          <TextInput
            onChange={(event) =>
              form.setFieldValue("description", event.currentTarget.value)
            }
            label="Description"
            placeholder="Description for this personal training session (optional)"
          />
          <Group justify="flex-end" mt="md">
            <Button type="submit" fullWidth>
              Submit
            </Button>
          </Group>
        </form>
      </Box>
    );
  }

  const handleBookSelected = () => {
    modals.open({
      title: "Add Description",
      children: <DescriptionForm></DescriptionForm>,
    });
  };

  return <MantineReactTable table={table} />;
};

//READ hook (get users from api)
function useGetTimeSlots() {
  return useQuery<TimeSlot[]>({
    queryKey: ["TimeSlots"],
    queryFn: async () => {
      //send api request here
      const response = await fetch("/api/member/trainer-availability/get", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      return data;
    },
    refetchOnWindowFocus: true,
  });
}