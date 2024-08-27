<script lang="ts">

    import waves from "$lib/assets/images/waveform.jpg"
    import compositionImage from "$lib/assets/images/compositionTeam.jpg"
    import tosaImage from "$lib/assets/images/tosaTestimonial.jpg"
    import progressImage from "$lib/assets/images/progressTestimonial.png"
    import beach from "$lib/assets/images/beach.jpg"
    import hills from "$lib/assets/images/hills.jpg"
    import lake from "$lib/assets/images/alpineLake.jpg"
    import tim from "$lib/assets/images/tim.jpg"
    import erik from "$lib/assets/images/erik.jpg"
    import car from "$lib/assets/images/reddoorCar.jpg"
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SliderOfTestimonialBoxes from "$lib/components/FullWidth/SliderOfTestimonialBoxes.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte"

  const testimonialBoxPropsArray = [ 
    {
        float: "left",
        testimonialText:  `"I've depended on Reddoor Creative for the last four companies I've led. Is there a better testimonial than that? \n\nReddoor has been integral to our growth, given us a clear voice, a distinctive brand presence and allowed us to compete with the major players in our industry. They've helped me grow Composition from a $1M company to a $10M company in a matter of a few years. I've seen the same percentages of growth for each of the previous companies we've worked on together."`,
        attribution:"Jeff Luchonok",
        attributionLabel: "PRINCIPAL / COMPOSITION HOSPITALITY",
        image: compositionImage
    },
    {
        float: "left",
        testimonialText:  `"Despite previous attempts, our brand and image has never connected with who we really are. When we engaged with Reddoor Creative they immediately impressed us. They began by listening to our hopes and where our organization was heading along with the image we wanted to portray.\n\nThe entire process with Reddoor was simple and focused: they honed in on our vision, offered direction and delivered. Our new brand helps us tell the story about how organ donation saves lives. Reddoor has helped to create a renewed energy within our organization and the organ donation community-at-large."`,
         attribution:"Jessica Rudd",
        attributionLabel: "DIRECTOR of QUALITY SERVICES / TEXAS ORGAN SHARING ALLIANCE",
        image: tosaImage
    },
    {
        float: "left",
        testimonialText:  "In the middle of one of our biggest projects of the year we were left stranded without a design firm partner. Reddoor came in to pick up the pieces and delivered on time. \n\n Honestly, I didn't think it was possible. Since that point I've had complete confidence in the Reddoor team to deliver beautiful results, even for our most complex projects.",
        attribution:"Jennfier Kis",
        attributionLabel: "DIRECTOR of MARKETING COMMUNICATIONS / PROGRESS LIGHTING",
        image: progressImage
    },
  ]
    
</script>
<svelte:head>
    <title>About | Reddoor Creative</title>
</svelte:head>

<div class="w-screen h-[50vh] max-h-96 relative">
    <img src={waves} class="w-full h-full absolute"alt="waves"/>
    <div class="w-full h-full absolute " style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"></div>
    <ContentWidth class="h-full flex justify-center items-center">
        <h4 class="text-white w-4/5 max-w-[800px] z-10">We design beautiful marketing materials that help you thrive.</h4>
    </ContentWidth>
</div>
<div class="w-screen relative">
    <ContentWidth class="flex flex-col md:flex-row">
        <h6 class="md:w-1/5 text-primary my-6 md:my-16 md:translate-y-2">Testimonials</h6>
        <div class="md:w-3/5 py-6 md:py-12">
            <h4 class="text-primary">Our clients are saying...</h4>
            <SliderOfTestimonialBoxes {testimonialBoxPropsArray}/>
        </div>
    </ContentWidth>
</div>
<div class="w-screen flex flex-col lg:flex-row relative bg-white">
    <div class="w-full lg:w-1/3 aspect-square relative flex items-center justify-center">
      <img class="w-full h-full absolute z-0 object-cover" src={beach} alt="beach"/>
       <h3 class="text-white z-10">CA</h3>
    </div>
    <div class="w-full lg:w-1/3 aspect-square relative flex items-center justify-center">
        <img class="w-full h-full absolute z-0 object-cover" src={hills} alt="hills"/>
         <h3 class="text-white z-10">TX</h3>
      </div>
      <div class="w-full lg:w-1/3 aspect-square relative flex items-center justify-center">
        <img class="w-full h-full absolute z-0 object-cover" src={lake} alt="lake"/>
         <h3 class="text-white z-10">ID</h3>
      </div>
  </div>
  <div class="w-screen text-center py-20 bg-white">
    <ContentWidth>
        <h4 class="text-primary">Serving our clients, near and far.</h4>
        <p class="mt-8 max-w-screen-md">We work with clients across the US and occasionally around the globe. We have designers sprinkled across California, Texas and Idaho, conveniently located near the Los Angeles, San Antonio, and Boise metro areas. Regardless of your location, partnering with Reddoor Creative will give you the confidence in your brand that you've been needing. </p>
        <a class="mt-6" href="/contact">
            <DefaultButton bold filled text="MEET WITH US"/>
        </a>
    </ContentWidth>
  </div>

  <div class="w-screen pb-20 bg-white">
    <ContentWidth class="flex flex-col md:flex-row justify-evenly">
        <div class="w-64 flex flex-col">
            <img src={tim} alt="tim" class="w-full aspect-square"/>
            
                <div class="text-primary large-body font-thin mt-2">Tim Holmes</div>
                <p class="text-mid font-thin">CA+ID Creative Director</p>
  
        </div>
        <div class="w-64 flex flex-col">
            <img src={erik} alt="erik" class="w-full aspect-square"/>
            <p class="text-primary large-body mt-2 large-body">Erik Svendsen</p>
            <div class="font-thin">TX Creative Director</div>
        </div>

    </ContentWidth>

  </div>
  <div class="w-screen bg-paper pt-12 pb-24">
    <ContentWidth class="flex flex-col md:flex-row">
        <h6 class="md:w-1/5 text-primary">Our Values</h6>
        <div class="w-full md:w-4/5 flex flex-row flex-wrap">
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="-translate-x-[1px] h-full">1</h5></div>
                <p class="large-body mt-4 text-primary">Compelling Solutions</p>
                <p class="label">Well thought out creativity that tells a clear story.</p>
            </div>
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">2</h5></div>
                <p class="large-body mt-4 text-primary">On Your Behalf</p>
                <p class="label">We exist to serve and care for our clients by helping them with our gifts and talents.</p>
            </div>
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">3</h5></div>
                <p class="large-body mt-4 text-primary">Instill Confidence</p>
                <p class="label">Creating a boldness and pride for our clients that they didn't have before.</p>
            </div>
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">4</h5></div>
                <p class="large-body mt-4 text-primary">Beautiful Design</p>
                <p class="label">We value, create and celebrate beautiful design.</p>
            </div>
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">5</h5></div>
                <p class="large-body mt-4 text-primary">Meaningful Work</p>
                <p class="label">The work of our clients matters to us as does our own work.</p>
            </div>
            <div class="p-2 w-full md:w-1/2 lg:w-1/3 flex flex-col">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">6</h5></div>
                <p class="large-body mt-4 text-primary">Life Balance</p>
                <p class="label">Encouraging a healthy work/life balance for ourselves and clients.</p>
            </div>

        </div>

    </ContentWidth>

  </div>

<div class="w-screen pt-24 bg-white">
    <h4 class="text-primary text-center">The Reddoor Story</h4>
    <ContentWidth><img class="w-full" src={car} alt="a white car with a red door"/>
    </ContentWidth>
    <ContentWidth class="flex flex-row">
        <div class="flex flex-col justify-center items-center md:w-4/5 md:ml-[20%] my-8">
        <h5 class="text-primary">Because of unforeseen circumstances owner, Tim Holmes, found himself stuck in LA with a white Toyota and a seemingly unfortunate red door.</h5>
            <div class="flex flex-col md:flex-row mt-12 pb-24">
                <p class="md:w-1/2 md:pr-12">    The young designer soon realized that in city where "your wheels" are a part of your identity he had two choices: be embarrassed or embrace the moment. Choosing the latter he quickly told his friend how excited he was to get a red door since he always wanted a red sports car and thought he'd start with the driver's side door and just work his way around replacing one piece at a time.</p>
                <p class="md:w-1/2 md:pr-12">The car soon became known as "reddoor" having its own personality because of the one thing that most people would see as unfortunate. With a proud owner it had no other reason than to be proud, too. What once was headed for the trash heap was now a gem of a story.</p>
            </div>
        <div class="w-full border-t-1 border-t-mid pt-6">
            <p class="large-body text-primary">The original "reddoor" taught us two things at Reddoor Creative:</p>
            <div class="w-full flex flex-col sm:flex-row gap-4 sm:gap-16  mt-12">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="-translate-x-[1px] h-full">1</h5></div>
                
                <h5 class="sm:w-4/5">Find the unique quality within a business and tell that story in a compelling way.</h5>
            </div>
            <div class="w-full flex flex-col sm:flex-row gap-4 sm:gap-16 mt-12">
                <div class="text-mid border-1 border-mid rounded-full w-12 h-12 flex justify-center items-center"><h5 class="h-full">2</h5></div>
                <h5 class="sm:w-4/5">Champion our clients and remember that we exist to serve them with our talents. </h5>
            </div>
        </div>
        </div>
    </ContentWidth>
</div>