# Node.js Email Queue Job Scheduling Example

A very common use case for a Node.js job scheduler is the sending of emails.

We highly recommend you to use `bree` in combination with the `email-templates` package (made by the same author). Not only does it let you easily manage email templates, but it also automatically opens email previews in your browser for you during local development (using preview-email).

## Tips for production

You will then create in your application a MongoDB "email" collection (or SQL table) with the following properties (or SQL columns):

`template` (String) - the name of the email template
`message` (Object) - a Nodemailer message object
`locals` (Object) - an Object of locals that are passed to the template for rendering

Here are optional properties/columns that you may want to also add (you'll need to implement the logic yourself as the example provided below does not include it):

`send_at` (Date) - the Date you want to send an email (should default to current Date.now() when record is created, and can be overridden on a per job basis)
`sent_at` (Date) - the Date that the email actually got sent (set by your job in Bree - you would use this when querying for emails to send, and specifically exclude any emails that have a sent_at value sent in your query)
response (Object) - the mixed Object that is returned from Nodemailer sending the message (you should store this for historical data and so you can detect bounces)

In your application, you will then need to save a new record into the collection or table (where you want to trigger an email to be queued) with values for these properties.

## Note on locking

Lastly, you will need to set up Bree to fetch from the email collection every minute (you can configure how frequent you wish, however you may want to implement locking, by setting an `is_locked` Boolean property, and subsequently unlocking any jobs locked more than X minutes ago – but typically this is not needed unless you are sending thousands of emails and have a slow SMTP transport).
