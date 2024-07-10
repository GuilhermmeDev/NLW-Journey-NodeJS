import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";

export async function getActivities(app: FastifyInstance) {
    await app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/activities', {
        schema: {
            params: z.object({
                tripId: z.string().uuid(),
            }),
        }
    } ,async (request) => {
        const { tripId } = request.params

        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            },
            include: {
                activities: {
                    orderBy: {
                        occurs_at: "asc",
                    }
                }
            }
        })

        if (!trip) {
            throw new Error("Trip not found.")
        }

        const diffBetweenTripStarEnd = dayjs(trip.ends_at).diff(trip.start_at, 'days')

        const activities = Array.from({length: diffBetweenTripStarEnd + 1}).map((_, i) => {
            const date = dayjs(trip.start_at).add(i, 'days')

            return {
                date: date.toDate(),
                activities: trip.activities.filter(activity => {
                    return dayjs(activity.occurs_at).isSame(date, 'day')
                })
            }
        })

        return {activities}
    })
}