
## broad

I like the data we're getting, so let's start by reorganizing it into a cohesive narrative and let that show us the gaps before we make any changes to the backend of the audit system. as we build this we can add a list of nice to haves.

First the headline and the highest leverage finding from the audit, along with an invitation to read through the process and anchor link to the fixes section if they'd rather jump to that.

answer the questions, and then inform

There should be a version of this site where we go 'check, check, check." yep you're doing everything right, . In fact, we want to get our site there, and our site is not perfect yet. which is why it's a test case, but also I think we talked about a fixture that passes everything at one point, did we ever work on that?

## revised order of sections
Hero/Headline

What an AI says About You
    Where you stand in AI answers

What you control
    Does it work?
    Does your site do its job
    What buyers can and cannot learn from your site

Fixes


## design

use the whole content width. talking desktop, you got right that we have  a 240px column on the left, but kill the maxwidths you've built for the rest of the content, that's what the contentwidth is for and everything feels too compressed horizontally. 

we're using way too much vertical space passed checks, be more liberal with accordians, 'What Passes' should be one openable section, otherwise they shouldn't hear anything about tests we ran that look good. they should be a 'I checked this and it's good' not listing stuff out. You lead and emphasize the right thing (we're hard to disambuiguate, a real problem), but you give no solutions and then go into all the things that are working, which kills any urgency of the audit

use our heading styles, they're defined for a reason

no double asides, 


## Section by section notes:


the "12 things to fix, in order" section is good but should just start with our recommendations as the subheader+body and kill that 'what we measured' bit, it doesn't make sense in that context andbelongs elsewhere. otherwise, it's great as is, outsiding of the global spacing notes

What an AI already says about you:
WE should be able to manually choose our search terms, either based on the client or our own thoughts, and have them only be generated if left blank, put a pin in that for now

let's get this to a place where I can put it in front of erik and tim tomorrow