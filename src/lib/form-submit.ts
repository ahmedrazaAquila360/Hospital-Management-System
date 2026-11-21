import { startTransition, type FormEvent } from "react";

/**
 * `onSubmit` handler for a `<form action={formAction}>` driven by `useActionState`.
 *
 * React 19 resets a form's uncontrolled fields after every form action, including one
 * that comes back with validation errors, so the user lost everything they had typed.
 * Running the action from `onSubmit` instead skips that reset. React still reports
 * `useFormStatus().pending` because the submit event scheduled a transition.
 *
 * Keep the `action` prop as well: a submit that happens before hydration then still goes
 * to the server action, rather than falling back to a GET that would put the fields
 * (passwords included) in the URL.
 *
 * Also avoids a Radix Select pitfall: a native reset rewinds a Select's hidden <select>
 * without updating its trigger, so the next submit silently sent the old value.
 */
export function submitWithoutReset(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  };
}
