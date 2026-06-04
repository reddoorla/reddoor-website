import { createClient } from "$lib/prismicio";
import { isFilled, filter } from "@prismicio/client";
import { error } from "@sveltejs/kit";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
  const client = createClient({ fetch, cookies });

  let page;

  try {
    page = await client.getByUID("project", params.uid);
  } catch {
    throw error(404, {
      message: "Project Not Found",
    });
  }

  const allProjects = await client.getAllByType("project", {
    orderings: {
      field: "document.first_publication_date",
      direction: "desc",
    },

    filters: [filter.not("document.tags", ["hide"])],
  });

  const currentIndex = allProjects.findIndex((project) => project.uid === params.uid);
  const prevProject = allProjects[currentIndex + 1] || null;
  const nextProject = allProjects[currentIndex - 1] || null;
  let relatedProjectOne = prevProject;
  let relatedProjectTwo = nextProject;
  let isOneSet = false;
  let isTwoSet = false;

  if (isFilled.contentRelationship(page.data.relatedprojectoverride1)) {
    relatedProjectOne =
      allProjects[
        allProjects.findIndex(
          (project) =>
            // @ts-expect-error prismic types don't narrow .uid through isFilled
            project.uid === page.data.relatedprojectoverride1.uid,
        )
      ];
    isOneSet = true;
  }

  if (isFilled.contentRelationship(page.data.relatedprojectoverride2)) {
    relatedProjectTwo =
      allProjects[
        allProjects.findIndex(
          (project) =>
            // @ts-expect-error prismic types don't narrow .uid through isFilled
            project.uid === page.data.relatedprojectoverride2.uid,
        )
      ];
    isTwoSet = true;
  }

  if (!isTwoSet) {
    const projectTags = [{ tag: "branding", count: 0 }];
    let tagTotalCount = 0;
    projectTags.push({ tag: "product", count: 0 });
    projectTags.push({ tag: "packaging", count: 0 });
    projectTags.push({ tag: "print", count: 0 });
    projectTags.push({ tag: "environmental", count: 0 });
    projectTags.push({ tag: "digital", count: 0 });
    page.tags.forEach((tag) => {
      projectTags.push({ tag: tag, count: 0 });
    });

    allProjects.forEach((project) => {
      project.tags.forEach((tag) => {
        projectTags.forEach((projectTag) => {
          if (projectTag.tag === tag) {
            projectTag.count++;
            tagTotalCount++;
          }
        });
      });
      if (project.data.branding) {
        projectTags[0].count++;
        tagTotalCount++;
      }
      if (project.data.product) {
        projectTags[1].count++;
        tagTotalCount++;
      }
      if (project.data.packaging) {
        projectTags[2].count++;
        tagTotalCount++;
      }
      if (project.data.print) {
        projectTags[3].count++;
        tagTotalCount++;
      }
      if (project.data.environmental) {
        projectTags[4].count++;
        tagTotalCount++;
      }
      if (project.data.digital) {
        projectTags[5].count++;
        tagTotalCount++;
      }
    });

    let mostRelatedProject = allProjects[0];
    let mostRelatedProjectScore = 0;
    let secondMostRelatedProject = allProjects[0];
    let secondMostRelatedProjectScore = 0;

    allProjects.forEach((project) => {
      if (project.uid !== params.uid) {
        let relatednessScore = 0;
        project.tags.forEach((tag) => {
          projectTags.forEach((projectTag) => {
            if (projectTag.tag === tag) {
              relatednessScore += tagTotalCount / projectTag.count;
            }
          });
        });
        if (project.data.branding && page.data.branding) {
          relatednessScore += tagTotalCount / projectTags[0].count;
        }
        if (project.data.product && page.data.product) {
          relatednessScore += tagTotalCount / projectTags[1].count;
        }
        if (project.data.packaging && page.data.packaging) {
          relatednessScore += tagTotalCount / projectTags[2].count;
        }
        if (project.data.print && page.data.print) {
          relatednessScore += tagTotalCount / projectTags[3].count;
        }
        if (project.data.environmental && page.data.environmental) {
          relatednessScore += tagTotalCount / projectTags[4].count;
        }
        if (project.data.digital && page.data.digital) {
          relatednessScore += tagTotalCount / projectTags[5].count;
        }

        if (relatednessScore > mostRelatedProjectScore) {
          secondMostRelatedProject = mostRelatedProject;
          secondMostRelatedProjectScore = mostRelatedProjectScore;
          mostRelatedProject = project;
          mostRelatedProjectScore = relatednessScore;
        } else if (relatednessScore > secondMostRelatedProjectScore) {
          secondMostRelatedProject = project;
          secondMostRelatedProjectScore = relatednessScore;
        }
      }
    });

    if (!isOneSet) {
      relatedProjectOne = mostRelatedProject;
      relatedProjectTwo = secondMostRelatedProject;
    } else {
      relatedProjectTwo = mostRelatedProject;
    }
  }

  return {
    page,
    title: page.data.title + " | Reddoor Creative",
    heroHeading: page.data.title,
    meta_description:
      page.data.meta_description || page.data.tagline || "Check out our work on " + page.data.title,
    meta_title: page.data.meta_title || page.data.title + " | Reddoor Creative",
    meta_image: page.data.meta_image.url || page.data.hero?.url || metaImage,
    prevProject,
    nextProject,
    relatedProjectOne,
    relatedProjectTwo,
  };
};

export async function entries() {
  const client = createClient();

  const pages = await client.getAllByType("project");

  return pages.map((page) => {
    return { uid: page.uid };
  });
}
